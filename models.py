from django.db import models
from django.core.files.storage import FileSystemStorage
from django.forms import ModelForm
from django.forms import ValidationError
from django.forms.util import ErrorList
from django.conf import settings
from django.db.models.fields.files import FieldFile
from django.forms.util import ErrorList

from urllib import urlopen
from Bio import AlignIO
from StringIO import StringIO
import os

# what's the right place for object URLs?
# what's the right place for forms?

ALIGNMENT_FORMAT_CHOICES = (
    ('clustal', 'Clustal'),
    ('fasta', 'Fasta'),
    ('stockholm', 'Stockholm'),
    ('emboss', 'EMBOSS'),
)

MSSM_UPLOAD_DIR = 'mssm/uploads'


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
    source_file = models.FileField(blank=True, null=True, upload_to=MSSM_UPLOAD_DIR)
    
    def extract_alignment_details(self, biopy_alignment):
            
        self.length = biopy_alignment.get_alignment_length()
        self.save()
        
        for biopy_seqrec in biopy_alignment:
            new_row = AlignmentRow()
            new_row.alignment = self
            new_row.sequence = str(biopy_seqrec.seq)
            new_row.name = biopy_seqrec.id
            new_row.save()
            
            
    def save_file(self, file_contents):
        if not self.source_file:
            model_field = self.source_file.field
            upload_filename = model_field.generate_filename(self, "%d.%s" % (self.id, self.format))
            upload_file = open(os.path.join(settings.MEDIA_ROOT, upload_filename), 'w')
            upload_file.write(file_contents)
            upload_file.close()
            self.source_file = FieldFile(instance=self, field=model_field, name=upload_filename)
            self.save()
            
            
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
        source_url = cleaned_data.get('source_url')
        source_file = cleaned_data.get('source_file')
        format = cleaned_data.get('format')
            
        if source_file:
            # workaround for ticket 7712: source_file if often an InMemoryUploadedObject, which doesn't implement readlines()
            # (see http://code.djangoproject.com/ticket/7712)
            
            file_object = StringIO(source_file.read())

        elif source_url:
            try:
                file_contents = urlopen(source_url).read()
            except IOError:
                self._errors['source_url'] = ErrorList(['Could not load url: %s' % source_url])
                del cleaned_data['source_url']
                return cleaned_data
            
            cleaned_data['file_contents'] = file_contents
            file_object = StringIO(file_contents)
            
        else:
            raise ValidationError("You need to either supply a file or a valid URL.")
        
        try:
            biopy_alignment = AlignIO.read(file_object, format)
        except ValueError:
            raise ValidationError("The supplied file could not be parsed. Perhaps you chose the wrong format?")
        
        cleaned_data['biopy_alignment'] = biopy_alignment
        return cleaned_data
    
        
    class Meta:
        model = Alignment
        exclude = ('length',)
