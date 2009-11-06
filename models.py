from django.db import models
from django.forms import ModelForm
from django.forms import ValidationError
from django.forms.util import ErrorList
from django.conf import settings
from django.db.models.fields.files import FieldFile


from urllib import urlopen
from Bio import AlignIO
from StringIO import StringIO
from datetime import datetime

import os, tempfile


ALIGNMENT_FORMAT_CHOICES = (
    ('clustal', 'Clustal'),
    ('fasta', 'Fasta'),
    ('stockholm', 'Stockholm'),
    ('emboss', 'EMBOSS'),
)

UPLOAD_DIR = 'noraseq/uploads'


class Alignment(models.Model):

    name = models.CharField("Alignment name", max_length=100)
    source_url = models.URLField(max_length=1000, blank=True, null=True)
    local_file = models.FileField(blank=True, null=True, upload_to=UPLOAD_DIR)
    format = models.CharField(
        "Format of alignment file",
        max_length=max([len(t[0]) for t in ALIGNMENT_FORMAT_CHOICES]), 
        choices = ALIGNMENT_FORMAT_CHOICES,
    )
    description = models.TextField("Description of alignment")
    context_url = models.URLField("Optional URL with more info", max_length=1000, blank=True)
    creation_date = models.DateTimeField(auto_now_add=True)
    length = models.IntegerField(blank=True, null=True, editable=False)
    newick = models.TextField(blank=True)
    
    @models.permalink
    def get_absolute_url(self):
        return ('noraseq.views.alignment_detail', [self.id])

    def __unicode__(self):
        return self.name
    
    def get_biopy_alignment(self):
        return self._biopy_alignment

    def set_biopy_alignment(self, value):
        self._biopy_alignment =  value
        self.length = value.get_alignment_length()
        self.save()
        self.extract_rows_and_columns()

    biopy_alignment = property(get_biopy_alignment, set_biopy_alignment)
    
    def extract_rows_and_columns(self):
        
        cols = [[]] * self.length
        row_num = 1

        for biopy_seqrec in self.biopy_alignment:
            new_row = Row()
            new_row.alignment = self
            seq = str(biopy_seqrec.seq)
            new_row.sequence = seq
            new_row.name = biopy_seqrec.id
            new_row.num = row_num
            row_num += 1
            new_row.save()

            for col_num in range(self.length):
                cols[col_num].append(seq[col_num])
        
        for col_num in range(self.length):
            new_col = Column()
            new_col.alignment = self
            new_col.sequence = ''.join(cols[col_num])
            new_col.num = col_num + 1       # 1-based indexing for row and column numbering
            new_col.save()
            
        self.extract_tree()
        
        
    def extract_tree(self):
        
        f = None
        
        # make sure there's a stockholm format file for quicktree to read from
        if self.local_file.name and self.format == "stockholm":
            print "using stockholm upload"
            fname = self.local_file.name
        else:
            f = tempfile.NamedTemporaryFile()
            print "created temp file %s" % f.name
            AlignIO.write([self.biopy_alignment], f, "stockholm")
            f.flush()
            print "wrote stockholm format"
            fname = f.name
        
        # quicktree has to be in the PATH for this
        print "opening quicktree..."
        p = subprocess.Popen(['quicktree', fname], shell=False, stdout=subprocess.PIPE)
        print "quicktree opened. Waiting..."
        
        # there should be some elementary error checking here (i.e., check return code of p)
        p.wait()
        print "wait done."
        
        self.newick = p.communicate()[0]
        
        # process the tree here!         

        if f:
            f.close()
        
            
            
    def save_to_file(self, unsaved_contents):
        if not self.local_file:
            model_field = self.local_file.field
            upload_filename = model_field.generate_filename(self, "%d.%s" % (self.id, self.format))
            upload_file = open(os.path.join(settings.MEDIA_ROOT, upload_filename), 'w')
            upload_file.write(unsaved_contents)
            upload_file.close()
            self.local_file = FieldFile(instance=self, field=model_field, name=upload_filename)
            self.save()


class Row(models.Model):
    alignment = models.ForeignKey(Alignment, related_name = 'rows', db_index=True)
    num = models.IntegerField(editable=False, db_index=True)
    name = models.CharField(max_length=100)
    sequence = models.TextField()
    comment = models.TextField(blank=True)
    
    def __unicode__(self):
        return self.name

    class Meta:
        unique_together = ('alignment', 'num')


class Column(models.Model):
    alignment = models.ForeignKey(Alignment, related_name = 'columns', db_index=True)
    num = models.IntegerField(editable=False, db_index=True)
    sequence = models.TextField()
    comment = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('alignment', 'num')


class Cell(models.Model):
    row = models.ForeignKey(Row, db_index=True)
    column = models.ForeignKey(Column, db_index=True)
    comment = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('column', 'row')

    
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
            biopy_alignment_file = local_file

        elif source_url:
            try:
                remote_url_contents = urlopen(source_url).read()
            except IOError:
                self._errors['source_url'] = ErrorList(['Could not load url: %s' % source_url])
                del cleaned_data['source_url']
                return cleaned_data
            
            cleaned_data['remote_url_contents'] = remote_url_contents
            biopy_alignment_file = StringIO(remote_url_contents)
            
        else:
            raise ValidationError("You need to either supply a file or a valid URL.")
        
        try:
            biopy_alignment = AlignIO.read(biopy_alignment_file, format)
        except ValueError:
            raise ValidationError(
                "The alignment could not be parsed. Perhaps you chose the wrong format?")
        
        cleaned_data['biopy_alignment'] = biopy_alignment
        return cleaned_data


class EditAlignmentForm(BaseAlignmentForm):
    
    class Meta(BaseAlignmentForm.Meta):
        exclude = ['source_url', 'local_file', 'format', 'newick']
