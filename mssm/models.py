from django.db import models
from django.core.files.storage import FileSystemStorage
from django.forms import ModelForm
from django.forms import ValidationError
from Bio import AlignIO

# what's the right place for object URLs?
# what's the right place for forms?

ALIGNMENT_FORMAT_CHOICES = (
	('clustal', 'Clustal'),
	('fasta', 'Fasta'),
	('stockholm', 'Stockholm'),
	('emboss', 'EMBOSS'),
)

class Alignment(models.Model):
	name = models.CharField(max_length=100)
	description = models.TextField()
	context_url = models.URLField(max_length=1000, blank=True)
	creation_date = models.DateTimeField(auto_now_add=True)
	length = models.IntegerField(blank=True, null=True)
	format = models.CharField(
		max_length=max([len(t[0]) for t in ALIGNMENT_FORMAT_CHOICES]), 
		choices = ALIGNMENT_FORMAT_CHOICES
	)
	source_url = models.URLField(max_length=1000, blank=True, null=True)
	source_file = models.FileField(blank=True, null=True, upload_to='mssm/uploads')
	
	def extract_rows(self):

		# self.source_file.file is a django.core.files.base.File
		# which AlignIO cannot use; therefore we need to drill down to the python file object.

		alignment_file = self.source_file.file.file
		biopy_alignment = AlignIO.read(alignment_file, self.format)
		self.length = biopy_alignment.get_alignment_length()
		self.save()

		for biopy_seqrec in biopy_alignment:
			new_row = AlignmentRow()
			new_row.alignment = self
			new_row.sequence = str(biopy_seqrec.seq)
			new_row.name = biopy_seqrec.id
			new_row.save()
			
	def __unicode__(self):
		return self.name


class AlignmentRow(models.Model):
	alignment = models.ForeignKey(Alignment)
	name = models.CharField(max_length=100)
	sequence = models.TextField()

	def _get_sequence_as_list(self):
		return [c[0] for c in zip(self.sequence)]
	def _set_sequence_as_list(self, seqlist):
		self.sequence = ''.join(seqlist)
		
	sequence_as_list = property(_get_sequence_as_list, _set_sequence_as_list)
	
	def __unicode__(self):
		return self.name

class AlignmentForm(ModelForm):
	
	def clean(self):
		cleaned_data = self.cleaned_data
		source_url = cleaned_data.get("source_url")
		source_file = cleaned_data.get("source_file")
		
		if not(source_url or source_file):
			raise ValidationError("You need to either supply a file or a valid URL.")
		
		return cleaned_data
		
	class Meta:
		model = Alignment
		exclude = ('length',)
