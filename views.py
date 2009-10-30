from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseBadRequest
from django.core.urlresolvers import reverse
from django.conf import settings
from django.http import QueryDict
from django.template import RequestContext

from models import CreateAlignmentForm, EditAlignmentForm
from models import Alignment, Row

from itertools import izip

def alignment_list(request):

    if request.method == 'POST':
        print "okay, handling POST"
        form = CreateAlignmentForm(request.POST, request.FILES)

        if form.is_valid():
            print "form is valid"
            new_alignment = form.save()
            print "form saved"
            new_alignment.biopy_alignment = form.cleaned_data['biopy_alignment']
            print "set biopy_alignment"
            if 'remote_url_contents' in form.cleaned_data:
               new_alignment.save_to_file(form.cleaned_data['remote_url_contents'])

            return HttpResponseRedirect(new_alignment.get_absolute_url())

    elif request.method == 'GET':
        form = CreateAlignmentForm()
        if 'url' in request.GET and request.GET['url']:
            form.initial = { 'source_url': request.GET['url'] }

    alignments = Alignment.objects.all()
    return render_to_response('alignment_list.html', {'alignments' : alignments, 'form' : form})


def index(request):
    return render_to_response('index.html', {'absolute_url_prefix' : settings.ABSOLUTE_URL_PREFIX})


def deleted(request):
    return render_to_response('deleted.html')


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

        alignment_rows = alignment.rows.all().values("num", "name", "sequence")
        
        pre = alignment.prerenderer
        pre.load_template()
        for row in alignment_rows:
            row['prerendered_tds'] = pre.render_row(row['sequence'])

        context = {
            'alignment': alignment, 
            'alignment_rows': alignment_rows,
            'header_row': range(1,alignment.length+1),
            'num_cols': alignment.length
        }
        
        print "starting render"

        return render_to_response('alignment_detail.html', context, RequestContext(request))
