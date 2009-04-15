from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseNotAllowed
from django.core.urlresolvers import reverse

from models import AlignmentForm
from models import Alignment

def alignment_list(request):
        
    if request.method == 'POST':
        form = AlignmentForm(request.POST, request.FILES)
        
        if form.is_valid():
            new_alignment = form.save()
            new_alignment.extract_alignment_details(form.cleaned_data['biopy_alignment'])
            if 'file_contents' in form.cleaned_data:
                new_alignment.save_file(form.cleaned_data['file_contents'])

            return HttpResponseRedirect(reverse(alignment_detail, args=[new_alignment.id]))

    elif request.method == 'GET':
        form = AlignmentForm()
        if 'url' in request.GET and request.GET['url']:
            form.initial = { 'source_url': request.GET['url'] }
            
    else:
        response = HttpResponseNotAllowed(permitted_methods=['GET', 'POST'])
        response.write('Method %s not allowed.' % request.method)
        return response

    alignments = Alignment.objects.all()
    return render_to_response('alignment_list.html', {'alignments' : alignments, 'form' : form})


def alignment_detail(request, alignment_id):
    alignment = get_object_or_404(Alignment, pk=alignment_id)
    alignment_rows = alignment.alignmentrow_set.all()
    header_row = range(1,alignment.length+1)

    return render_to_response('alignment_detail.html', 
        { 'alignment': alignment, 
          'alignment_rows': alignment_rows,
          'header_row': header_row })
