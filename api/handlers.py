from piston.handler import BaseHandler, AnonymousBaseHandler
from piston.utils import rc, require_mime, require_extended

from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.core.urlresolvers import reverse

from itertools import izip

from noraseq.utils import PreRenderer

# import models below
from noraseq.models import Alignment, Row

class TunneledBaseHandler(BaseHandler):
    
    def create(self, request, *args, **kwargs):
        if request.POST and "tunneled_method" in request.POST:        
            method = request.POST["tunneled_method"]
            if method == "PUT":
                request.PUT = request.POST
                return self.update(request, *args, **kwargs)
            if method == "DELETE":
                return self.delete(request, *args, **kwargs)
        
        self.post(request, *args, **kwargs)


class AlignmentBase(BaseHandler):
    
    def read(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        return render_to_response('api/alignment_base.html', {'alignment': alignment})

class ColumnSortedAlignmentBase(AlignmentBase):
    
    def read(self, request, alignment_id, sort_cols):
        pass


class Table(BaseHandler):
    
    def read(self, request, alignment_id):
        alignment = get_object_or_404(Alignment, pk=alignment_id)
        
        # make sure to retrieve alignment_rows in "tree order"
        # (if 2 rows A & B have MRCA C, every row displayed between A & B must have C as an ancestor;
        # ordering in by 'clade__lft' guarantees this property)
        
        alignment_rows = alignment.rows.order_by("clade__lft").values("num", "name", "sequence")
        
        pre = PreRenderer("noraseq/prerendered_row_tds.html", alignment)
        for row in alignment_rows:
            row['prerendered_tds'] = pre.render_row(row['sequence'])

        return render_to_response('api/alignment_table.html',
            { 'alignment' : alignment,
              'alignment_rows': alignment_rows,
              'header_row': range(1,alignment.length+1),
              'num_cols' : alignment.length
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

        # pull out the common bits this shares with Table above...

        pre = PreRenderer("noraseq/prerendered_row_tds.html", alignment)
        for row in alignment_rows:
            row['prerendered_tds'] = pre.render_row(row['sequence'])

        keys_and_row_nums = get_keys_and_row_nums(alignment, sort_cols)
        sorted_rows = [alignment_rows[row_num-1] for key, row_num in sorted(keys_and_row_nums)]
    
        return render_to_response('api/alignment_table.html',
            { 'alignment' : alignment,
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
        keys_and_row_nums = get_keys_and_row_nums(alignment, sort_cols)

        # return a JSON mapping between row classes
                
        return dict((row_num_to_url(alignment_id, row), self.key_to_url(alignment_id, sort_cols, key))
            for key, row in keys_and_row_nums)

        
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


class CellResource(BaseHandler):
    
    def read(self, request, alignment_id, row_num, cell_num):
        pass
        
        
    