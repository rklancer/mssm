from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseNotAllowed
from django.core.urlresolvers import reverse
from django.conf import settings

from models import CreateAlignmentForm, EditAlignmentForm
from models import Alignment

from django.http import HttpResponse

def alignment_list(request):

    if request.method == 'POST':
        form = CreateAlignmentForm(request.POST, request.FILES)

        if form.is_valid():
            new_alignment = form.save()
            new_alignment.extract_alignment_details(form.cleaned_data['biopy_alignment'])
            if 'remote_url_contents' in form.cleaned_data:
               new_alignment.save_to_file(form.cleaned_data['remote_url_contents'])

            return HttpResponseRedirect(reverse(alignment_detail, args=[new_alignment.id]))

    elif request.method == 'GET':
        form = CreateAlignmentForm()
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
    
    # FIXME make this handle real PUT and DELETE
    
    if request.method == 'POST' and 'method_tunnel' in request.POST and request.POST['method_tunnel'] == 'DELETE':
        alignment.delete()
        return HttpResponseRedirect(reverse(deleted))
    
    elif request.method == 'POST' and 'method_tunnel' in request.POST and request.POST['method_tunnel'] == 'PUT':
        form = EditAlignmentForm(request.POST, instance=alignment)
            
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse(alignment_detail, args=[alignment.id]))

    elif request.method == 'GET':
        
        alignment_rows = alignment.alignmentrow_set.all()
        
        if 'sort-by' in request.GET and request.GET['sort-by']:
            sort_by = int(request.GET['sort-by'])
            col = [row.sequence[sort_by-1] for row in alignment_rows]
            l = zip(col, range(len(col)+1))
            l.sort()            # sorts list of tuples by first element of tuple, then second
            alignment_rows = [alignment_rows[t[1]] for t in l]

        if 'show-ungapped' in request.GET and request.GET['show-ungapped']:
            show_ungapped = int(request.GET['show-ungapped'])
            ungapped_row = alignment.alignmentrow_set.get(row_num=show_ungapped) 
            to_show = [r != '-' for r in ungapped_row.sequence]
        else:
            to_show = [True] * alignment.length

        header_row = [t[0] for t in zip(range(1,alignment.length+1), to_show) if t[1]]
        for row in alignment_rows:
            row.filtered_sequence = [t[0] for t in zip(row.sequence_as_list, to_show) if t[1]]

        context = { 'alignment': alignment, 
                    'alignment_rows': alignment_rows,
                    'header_row': header_row }

        if 'edit' in request.GET:
            context['edit_form'] = EditAlignmentForm(instance=alignment)
        elif 'delete' in request.GET:
            context['show_delete_form'] = True
            
        return render_to_response('alignment_detail.html', context)

    else:
        # technically, this is a lie. We don't even handle *actual* PUT requests yet
        
        response = HttpResponseNotAllowed(permitted_methods=['GET', 'PUT', 'DELETE'])
        response.write('Method %s not allowed.' % request.method)
        return response


def index(request):
    return render_to_response('index.html', {'absolute_url_prefix' : settings.ABSOLUTE_URL_PREFIX})
    
    
def deleted(request):
    return render_to_response('deleted.html')
    