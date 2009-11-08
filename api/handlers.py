from piston.handler import BaseHandler, AnonymousBaseHandler
from piston.utils import rc, require_mime, require_extended

from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.core.urlresolvers import reverse

from itertools import izip
import re

from noraseq.utils import PreRenderer

# import models below
from noraseq.models import Alignment, Row, ThresholdGrouping

class TunneledBaseHandler(BaseHandler):
    
    def create(self, request, *args, **kwargs):
        if request.POST and "tunneled_method" in request.POST:        
            method = request.POST["tunneled_method"]
            if method == "PUT":
                request.PUT = request.POST
                return self.update(request, *args, **kwargs)
            if method == "DELETE":
                return self.delete(request, *args, **kwargs)
        
        return self.post(request, *args, **kwargs)


class AlignmentBase(BaseHandler):
    
    def read(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        return render_to_response('api/alignment_base.html', 
            { 'alignment': alignment,
              'column_sorted': False
        })
        

def prerender_tds(rows, alignment):
    pre = PreRenderer("noraseq/prerendered_row_tds.html", alignment)
    for row in rows:
        row['prerendered_tds'] = pre.render_row(row['sequence'])


class Table(BaseHandler):
    
    def read(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        
        # make sure to retrieve alignment_rows in "tree order"
        # (if 2 rows A & B have MRCA C, every row displayed between A & B must have C as an ancestor;
        # ordering in by 'clade__lft' guarantees this property)
        
        alignment_rows = alignment.rows.order_by("clade__lft").values("num", "name", "sequence")
        prerender_tds(alignment_rows, alignment)

        return render_to_response('api/alignment_table.html',
            { 'alignment' : alignment,
              'column_sorted': False,
              'alignment_rows': alignment_rows,
              'header_row': range(1,alignment.length+1),
              'num_cols' : alignment.length
            })


class ColumnSortedBase(BaseHandler):

    def read(self, request, alignment_id, sort_cols):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        return render_to_response('api/alignment_base.html', 
            {'alignment': alignment,
             'column_sorted': True,
             'sort_cols': sort_cols,
             'sort_cols_humanized': sort_cols.replace('/', ', ')
            })


def get_keys_and_row_nums(alignment, sort_cols):
    # convert 'sort_cols' (string captured from url) into a list of numbers    
    sort_col_nums = [int(num) for num in sort_cols.split('/')]

    # get the corresponding Column objects
    columns = alignment.columns.filter(num__in=sort_col_nums)

    # get list of (key, id) tuples, where id = row num & key = row sequence limited to the sort columns
    return [(t,i+1) for i,t in enumerate(izip(*(col.sequence for col in columns)))]


class ColumnSortedTable(BaseHandler):

    def read(self, request, alignment_id, sort_cols):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        alignment_rows = alignment.rows.values("num", "name", "sequence")

        prerender_tds(alignment_rows, alignment)

        keys_and_row_nums = get_keys_and_row_nums(alignment, sort_cols)
        sorted_rows = [alignment_rows[row_num-1] for key, row_num in sorted(keys_and_row_nums)]
    
        return render_to_response('api/alignment_table.html',
            { 'alignment' : alignment,
              'column_sorted': True,
              'sort_cols_humanized': sort_cols.replace('/', ', '),
              'sort_cols': sort_cols,
              'alignment_rows': sorted_rows,
              'header_row': range(1,alignment.length+1),
              'num_cols' : alignment.length
            })
            
def row_num_to_url(alignment_id, row_num):
    return reverse('noraseq.api.resources.row', 
        kwargs={'alignment_id': str(alignment_id), 'row_num': str(row_num)})

                    
class ColumnSortedGroup(BaseHandler):
    
    def read(self, request, alignment_id, sort_cols, group_pattern):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        keys_and_row_nums = get_keys_and_row_nums(alignment, sort_cols)
        row_nums = [num for key, num in keys_and_row_nums if key == tuple(group_pattern.upper())]
        
        if not row_nums:
            raise Http404

        return [reverse('noraseq.api.resources.row', 
            kwargs={'alignment_id': alignment_id, 'row_num': str(num)}) for num in row_nums]


class ColumnSortedGroupList(BaseHandler):

    @classmethod
    def key_to_url(cls, alignment_id, sort_cols, key):
        group_pattern = ''.join(key)
        return reverse('noraseq.api.resources.column_sorted_group', 
            kwargs = { 'alignment_id': alignment_id, 'sort_cols': sort_cols, 'group_pattern': group_pattern })

    def read(self, request, alignment_id, sort_cols):

        alignment = get_object_or_404(Alignment, pk=alignment_id)

        mapping = {}
        groups = set()
        
        for key, row in get_keys_and_row_nums(alignment, sort_cols):
            group_url = self.key_to_url(alignment_id, sort_cols, key)
            mapping[row_num_to_url(alignment_id, row)] = group_url
            groups.add(group_url)
        
        return { 'groups': list(groups),
                 'mapping': mapping }


class ColumnSortedTableRedirector(BaseHandler):
    
    def read(self, request, alignment_id):
        # for now we're accepting a comma-separated list of column numbers. Could change accept URLs as well.
        if 'sort-cols' not in request.GET:
            return rc.BAD_REQUEST
        
        # change to allow for leading 'c's?

        sort_cols = request.GET['sort-cols']
        cols_re = re.compile(r"^(\d+,)*\d+$")
        if not cols_re.match(sort_cols):
            return rc.BAD_REQUEST
        
        # check that the alignment exists before redirecting to it
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        
        return HttpResponseRedirect(reverse('noraseq.api.resources.column_sorted_table',
            kwargs = {
                'alignment_id': alignment_id,
                'sort_cols': sort_cols.replace(',','/')
            }))


class ThresholdGroupingList(TunneledBaseHandler):

    def post(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)    
        if 'threshold-value' not in request.POST:
            return rc.BAD_REQUEST
        
        try:
            threshold = float(request.POST['threshold-value'])
        except ValueError:
            return rc.BAD_REQUEST

        response = HttpResponse(status=303)
        response['Location'] = reverse('noraseq.api.resources.threshold_group_list', 
            kwargs={
                'alignment_id': alignment_id, 
                'grouping_id': str(alignment.get_threshold_grouping(threshold).id)
            })
        
        return response
        

    def read(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        
        return [reverse('noraseq.api.resources.threshold_group_list', 
            kwargs={
                'alignment_id': alignment_id, 
                'grouping_id': str(id)
            }) for id in alignment.threshold_groupings.values_list('id', flat=True)]



def clade_to_group_url(clade, grouping_id):   
    return reverse('noraseq.api.resources.threshold_group', 
        kwargs={
            'alignment_id': str(clade.alignment.id), 
            'grouping_id': grouping_id,
            'group_id': str(clade.id)
        })
            

def row_to_url(row):
    return reverse('noraseq.api.resources.row', 
        kwargs={
            'alignment_id': str(row.alignment.id),
            'row_num': str(row.num)
        })
        
class ThresholdGroupList(BaseHandler):
    
    def read(self, request, alignment_id, grouping_id):
        grouping = get_object_or_404(ThresholdGrouping, alignment__pk=alignment_id, pk=grouping_id)
        
        groups = []
        mapping = {}
        for root_clade in grouping.root_clades.all():
            group_url = clade_to_group_url(root_clade, grouping_id)
            groups.append(group_url)
            for row in root_clade.get_descendants(include_self=True).filter(row__isnull=False):
                mapping[row_to_url(row)] = group_url
        
        return { 'groups': groups,
                 'mapping': mapping }
        

class ThresholdGroup(BaseHandler):
    
    def read(self, request, alignment_id, grouping_id, group_id):
        grouping = get_object_or_404(ThresholdGrouping, alignment__pk=alignment_id, pk=grouping_id)
        try:
            root_clade = grouping.root_clades.get(id=group_id)
        except DoesNotExist:
            return rc.NOT_FOUND
            
        return [row_to_url(c.row) 
            for c in root_clade.get_descendants(include_self=True).filter(row__isnull=False)]


class RowResource(BaseHandler):
    
    def read(self, request, alignment_id, row_num):
        row = get_object_or_404(Row, alignment__pk = alignment_id, num = row_num)
        return render_to_response('api/alignment_row.html', { 'row' : row })


class CommentOnRow(TunneledBaseHandler):
    
    def read(self, request, alignment_id, row_num):
        row = get_object_or_404(Row, alignment__pk = alignment_id, num = row_num)
        if not row.comment:
            raise Http404        
        return HttpResponse(row.comment)
            
    def update(self, request, alignment_id, row_num):
        row = get_object_or_404(Row, alignment__pk = alignment_id, num = row_num)
        row.comment = request.PUT["text"]
        row.save()
        return self.read(request, alignment_id, row_num)
    
    def delete(self, request, alignment_id, row_num):
        row = get_object_or_404(Row, alignment__pk = alignment_id, num = row_num)
        row.comment = ""
        row.save()
        return HttpResponse(status=204)

        
        
    