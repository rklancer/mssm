from piston.handler import BaseHandler, AnonymousBaseHandler
from piston.utils import rc, require_mime, require_extended

from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.core.urlresolvers import reverse

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
        
        alignment_rows = alignment.rows.all().values("num", "name", "sequence")
        
        pre = PreRenderer("noraseq/prerendered_row_tds.html", alignment)
        for row in alignment_rows:
            row['prerendered_tds'] = pre.render_row(row['sequence'])

        return render_to_response('api/alignment_table.html',
            { 'alignment' : alignment,
              'alignment_rows': alignment_rows,
              'header_row': range(1,alignment.length+1),
              'num_cols' : alignment.length
            })


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
        
        
    