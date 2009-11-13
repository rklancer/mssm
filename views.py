from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseBadRequest, HttpResponse
from django.core.urlresolvers import reverse
from django.conf import settings
from django.http import QueryDict
from django.template import RequestContext

from models import CreateAlignmentForm, EditAlignmentForm
from models import Alignment, Row

from itertools import izip

from noraseq.utils import PreRenderer


def dummy(request, **kwargs):
    response = HttpResponse()
    for arg in kwargs:
        response.write(arg + ':' + kwargs[arg])
    return response


def alignment_list(request):

    if request.method == 'POST':
        form = CreateAlignmentForm(request.POST, request.FILES)

        if form.is_valid():
            new_alignment = form.save()
            new_alignment.biopy_alignment = form.cleaned_data['biopy_alignment']
            if 'remote_url_contents' in form.cleaned_data:
               new_alignment.alignment_file_contents = form.cleaned_data['remote_url_contents']

            return HttpResponseRedirect(new_alignment.get_absolute_url())

    elif request.method == 'GET':
        form = CreateAlignmentForm()
        if 'url' in request.GET and request.GET['url']:
            form.initial = { 'source_url': request.GET['url'] }

    alignments = Alignment.objects.all()
    return render_to_response('noraseq/alignment_list.html', {'alignments' : alignments, 'form' : form})


def index(request):
    return render_to_response('noraseq/index.html', {'absolute_url_prefix' : settings.ABSOLUTE_URL_PREFIX})


def deleted(request):
    return render_to_response('noraseq/deleted.html')


def noraseq_viewer(request, alignment_id):
    
    alignment = get_object_or_404(Alignment, pk=alignment_id)
    context = { 'alignment': alignment, 
                'header_row': range(1,alignment.length+1),
                'base_url': reverse('noraseq.api.resources.alignment_base',
                    kwargs = {
                        'alignment_id': alignment.id
                    })
                }
    return render_to_response('noraseq/noraseq_viewer.html', context, RequestContext(request))
    

def alignment_detail(request, alignment_id):

    alignment = get_object_or_404(Alignment, pk=alignment_id)

    if request.method == 'POST':
        if request.POST['action'] == 'delete':
            alignment.delete()
            return HttpResponseRedirect(reverse(deleted))
        
        if request.POST['action'] == 'edit':
            form = EditAlignmentForm(request.POST, instance=alignment)
            if form.is_valid():
                form.save()
                return HttpResponseRedirect(alignment.get_absolute_url())
            else:
                return HttpResponseBadRequest("That input wasn't valid")
                
    elif request.method == 'GET':
        context = {}
        
        if 'edit' in request.GET:
            context['edit_form'] = EditAlignmentForm(instance=alignment)
        elif 'delete' in request.GET:
            context['show_delete_form'] = True

        alignment_rows = alignment.rows.order_by("clade__lft").values("num", "name", "sequence")
        
        pre = PreRenderer("noraseq/prerendered_row_tds.html", alignment)
        for row in alignment_rows:
            row['prerendered_tds'] = pre.render_row(row['sequence'])

        context['alignment'] = alignment 
        context['alignment_rows'] = alignment_rows
        context['header_row'] = range(1,alignment.length+1)
        context['num_cols'] = alignment.length

        return render_to_response('noraseq/alignment_detail.html', context, RequestContext(request))
