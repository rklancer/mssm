from django.shortcuts import render_to_response, get_object_or_404, get_list_or_404
from django.http import HttpResponseRedirect
from mssm.models import Alignment, AlignmentRow
from mssm.models import AlignmentForm
from django.db.models.fields.files import FieldFile
from urllib import urlretrieve
from django.conf import settings

def alignment_list(request):
	if request.method == 'POST':
		form = AlignmentForm(request.POST, request.FILES)
		if form.is_valid():
			new_alignment = form.save()
			
			if not new_alignment.source_file:
				# the field object from the Alignment model can generate a filename in the appropriate uploads directory
				model_field = new_alignment.source_file.field
				upload_filename = model_field.generate_filename(new_alignment, "%d.%s" % (new_alignment.id, new_alignment.format))
				urlretrieve(new_alignment.source_url, settings.MEDIA_ROOT + upload_filename)
				new_alignment.source_file = FieldFile(instance=new_alignment, field=model_field, name=upload_filename)
			
			new_alignment.save()
			new_alignment.extract_rows()
			
			# FIXME - get rid of hard coding of urls in the view
			
			return HttpResponseRedirect('/alignment/%d/' % new_alignment.id)
		else:
			# display form with errors
			return HttpResponseRedirect('/alignments/')

	if request.method == 'GET':
		form_data = {}
		if 'url' in request.GET and request.GET['url']:
			form_data['source_url'] = request.GET['url']
		form = AlignmentForm(form_data)
			
	alignments = Alignment.objects.all()
	return render_to_response('mssm/alignment_list.html', {'alignments' : alignments, 'form' : form})


def alignment_detail(request, alignment_id):
	alignment = get_object_or_404(Alignment, pk=alignment_id)
	alignment_rows = alignment.alignmentrow_set.all()
	header_row = range(1,alignment.length+1)

	return render_to_response('mssm/alignment_detail.html', 
		{'alignment': alignment, 
		 'alignment_rows': alignment_rows,
		 'header_row': header_row})
