from django.db import models
from django.core.files.storage import FileSystemStorage
from django.forms import ModelForm
from django.forms import ValidationError
from django.forms.util import ErrorList
from django.conf import settings
from django.db.models.fields.files import FieldFile

from urllib import urlopen
from Bio import AlignIO
from StringIO import StringIO
import os

ALIGNMENT_FORMAT_CHOICES = (
    ('clustal', 'Clustal'),
    ('fasta', 'Fasta'),
    ('stockholm', 'Stockholm'),
    ('emboss', 'EMBOSS'),
)

MSSM_UPLOAD_DIR = 'mssm/uploads'


class Alignment(models.Model):
    name = models.CharField("Alignment name", max_length=100)
    source_url = models.URLField(max_length=1000, blank=True, null=True)
    local_file = models.FileField(blank=True, null=True, upload_to=MSSM_UPLOAD_DIR)
    format = models.CharField(
        "Format of alignment file",
        max_length=max([len(t[0]) for t in ALIGNMENT_FORMAT_CHOICES]), 
        choices = ALIGNMENT_FORMAT_CHOICES,
        blank=False
    )
    description = models.TextField("Description of alignment")
    context_url = models.URLField("Optional URL with more info", max_length=1000, blank=True)
    creation_date = models.DateTimeField(auto_now_add=True)
    length = models.IntegerField(blank=True, null=True, editable=False)

    
    def extract_alignment_details(self, biopy_alignment):
        self.length = biopy_alignment.get_alignment_length()
        self.save()
        
        for biopy_seqrec in biopy_alignment:
            new_row = AlignmentRow()
            new_row.alignment = self
            new_row.sequence = str(biopy_seqrec.seq)
            new_row.name = biopy_seqrec.id
            new_row.save()
            
            
    def save_to_file(self, unsaved_contents):
        if not self.local_file:
            model_field = self.local_file.field
            upload_filename = model_field.generate_filename(self, "%d.%s" % (self.id, self.format))
            upload_file = open(os.path.join(settings.MEDIA_ROOT, upload_filename), 'w')
            upload_file.write(unsaved_contents)
            upload_file.close()
            self.local_file = FieldFile(instance=self, field=model_field, name=upload_filename)
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


class BaseAlignmentForm(ModelForm):
    
    class Meta:
        model = Alignment


class CreateAlignmentForm(BaseAlignmentForm):
    
    def clean(self):
        """
        # 1. validates that, if there is no local_file, that source_url downloads okay (placing contents in
             cleaned_data['remote_url_contents']
        # 2. validates that the resulting file, whether a local file or the contents of remote url, parses correctly
        # 3. Places resulting Biopython Alignment object in cleaned_data['biopy_alignment']
        """
        super(CreateAlignmentForm, self).clean()
        cleaned_data = self.cleaned_data
        source_url = cleaned_data.get('source_url')
        local_file = cleaned_data.get('local_file')
        format = cleaned_data.get('format')
        
        # this method (clean()) is called whether or not the format field validates.
        # Let's not waste resources downloading and parsing files if the format field isn't valid.
        
        if not format:
            return cleaned_data     # field validation will have already supplied required error messages

        if local_file:
            # workaround ticket 7712: local_file may be an InMemoryUploadedFile, which doesn't implement readlines()
            # (see http://code.djangoproject.com/ticket/7712)
            
            file_object = StringIO(local_file.read())

        elif source_url:
            try:
                remote_url_contents = urlopen(source_url).read()
            except IOError:
                self._errors['source_url'] = ErrorList(['Could not load url: %s' % source_url])
                del cleaned_data['source_url']
                return cleaned_data
            
            cleaned_data['remote_url_contents'] = remote_url_contents
            file_object = StringIO(remote_url_contents)
            
        else:
            raise ValidationError("You need to either supply a file or a valid URL.")
        
        try:
            biopy_alignment = AlignIO.read(file_object, format)
        except ValueError:
            raise ValidationError(
                "The file at the supplied URL could not be parsed. Perhaps you chose the wrong format?")
        
        cleaned_data['biopy_alignment'] = biopy_alignment
        return cleaned_data


class EditAlignmentForm(BaseAlignmentForm):
    
    class Meta(BaseAlignmentForm.Meta):
        exclude = ['source_url', 'local_file', 'format']
        
        
        