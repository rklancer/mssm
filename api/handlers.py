from piston.handler import BaseHandler, AnonymousBaseHandler
from piston.utils import rc, require_mime, require_extended

from django.http import HttpResponse
from django.shortcuts import render_to_response


# import models here

class AlignmentBase(BaseHandler):
    
    def read(self, request, alignment_id):
        # returning a response directly
        return render_to_response('api/alignment_base.html')


class ColumnSortedAlignmentBase(AlignmentBase):
    
    def read(self, request, alignment_id, sort_cols):
        pass
