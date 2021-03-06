from django.db import models
from django.forms import ModelForm
from django.forms import ValidationError
from django.forms.util import ErrorList
from django.conf import settings
from django.db.models.fields.files import FieldFile
from django.db.models import Count

from urllib import urlopen
from Bio import AlignIO
from Bio.Nexus.Nexus import Tree
from StringIO import StringIO
from datetime import datetime
from itertools import izip

import os, tempfile
import mptt

from noraseq.scores.conservation import calculate_sequence_weights, conservation, window_score

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
    newick_tree = models.TextField(blank=True)

    @models.permalink
    def get_absolute_url(self):
        return ('noraseq.views.alignment_detail', [self.id])

    def __unicode__(self):
        return self.name


    def get_biopy_alignment(self):
        if '_biopy_alignment' not in self.__dict__:
            # don't call set_biopy_alignment(). Want to make biopy_alignment available, not extract from it.
            self.local_file.open('r')
            self._biopy_alignment = AlignIO.read(self.local_file, self.format)
            self.local_file.close()

        return self._biopy_alignment

    def set_biopy_alignment(self, value):
        self._biopy_alignment = value
        self.length = value.get_alignment_length()
        self.save()
        self.extract_related_objects()

    biopy_alignment = property(get_biopy_alignment, set_biopy_alignment)


    def get_alignment_file_contents(self):
        if '_alignment_file_contents' not in self.__dict__:
            self.local_file.open('r')
            self._alignment_file_contents = self.local_file.read()
            self.local_file.close()

        return self._alignment_file_contents

    def set_alignment_file_contents(self, value):
        # cache the value
        self._alignment_file_contents = value

        # and save to permanent storage
        if not self.local_file:
            model_field = self.local_file.field     # note this works even though self.local_file is falsy
            upload_filename = model_field.generate_filename(self, "%d.%s" % (self.id, self.format))
            self.local_file = FieldFile(instance=self, field=model_field, name=upload_filename)
            self.save()

        # Django FieldFile open() method fails if the file doesn't exist in filesystem (even using mode 'w')
        upload_file = open(self.local_file.path, 'w')
        upload_file.write(value)
        upload_file.close()

    alignment_file_contents = property(get_alignment_file_contents, set_alignment_file_contents)


    def extract_related_objects(self):
        self.extract_rows_and_columns()
        self.extract_conservation_scores()
        self.newick_tree = self.get_newick_tree()
        self.save()
        tree = Tree(self.newick_tree)
        self.extract_clades(tree, tree.root)


    def extract_rows_and_columns(self):
        row_num = 1
        for biopy_seqrec in self.biopy_alignment:
            new_row = Row(
                alignment=self,
                sequence=str(biopy_seqrec.seq).upper(),
                name=biopy_seqrec.id, num=row_num)
            new_row.save()
            row_num += 1

        for col_num in range(self.length):
            new_col = Column(
                alignment=self,
                sequence=self.biopy_alignment.get_column(col_num).upper(),
                num=col_num+1)
            new_col.save()


    def get_newick_tree(self):
        temp = None

        # quicktree expects a stockholm format input file
        if self.local_file.name and self.format == "stockholm":
            fname = self.local_file.path
        else:
            temp = tempfile.NamedTemporaryFile()
            print "writing stockholm format file..."
            AlignIO.write([self.biopy_alignment], temp, "stockholm")
            temp.flush()
            fname = temp.name

        print "opening quicktree on stockholm format file %s" % fname
        quicktree_out = os.popen('quicktree %s' % fname)   # subprocess.Popen hangs the Django dev server

        # there should be some elementary error checking here...
        newick_tree = quicktree_out.read()
        print "quicktree finished"

        if temp:
            # 'temp' is unlinked immediately after creation--so be sure to close it only after we're certain
            # that quicktree succesfully opened it (i.e, only after read(), not just after popen())
            temp.close()

        return newick_tree


    def extract_clades(self, tree, n):
        print "extracting clade %d" % n

        node = tree.node(n)

        c = Clade(alignment=self, num=node.id, local_branch_length=node.data.branchlength)
        if node.prev is not None:
            c.parent = self.clades.get(num=node.prev)
            c.cumulative_branch_length = c.parent.cumulative_branch_length + c.local_branch_length

        if not node.succ:
            # no successors -> leaf node
            c.row = self.rows.get(name=node.data.taxon)

        c.save()

        for child in node.succ:
            self.extract_clades(tree, child)


    def get_threshold_grouping(self, threshold):
        """
        Given a threshold branch length, cut the tree at that branch length.
        Returns a ThresholdGrouping object corresponding to the cut, with the property that any time
        a given threshold corresponds to a previously-seen cut, the same ThresholdGroupSet is returned.
        """

        root_clades = self.clades.filter(cumulative_branch_length__gt=threshold,
            parent__cumulative_branch_length__lte=threshold)
        root_clade_ids = list(root_clades.values_list('id', flat=True))   # i.e., prevent requerying
        
        if not root_clade_ids:
            # no root clades (threshold is negative or greater than cumulative_branch_length for all clades)
            # so we should consider all clades to be in the same group, defined by the root clade
            root_clade_ids = [self.clades.all()[0].get_root().id]
            root_clades = Clade.objects.filter(id=root_clade_ids[0])

        # This query finds all the ThresholdGroupings that contain *all* clades in the 'root_clades' queryset.
        # Note that it's an obvious proof that, if a set of C of clades represents some cut, then can be no
        # other cut that contains all members of C.
        # So (modulo consistency issues) there should be at most one ThresholdGrouping returned, and it should
        # contain exactly the same set of root clades as in 'root_clades'

        existing_groupings = self.threshold_groupings.filter(
            root_clades__id__in=root_clade_ids
        ).annotate(
            num_clades=Count('root_clades')
        ).filter(
            num_clades=len(root_clade_ids)
        ).order_by(
            'id'
        )

        # if database consistency issue mean there are two existing_groupings, try to always return the first

        if len(existing_groupings) > 0:
            return existing_groupings[0]

        new_grouping = ThresholdGrouping(alignment=self, threshold=threshold)
        new_grouping.save()
        new_grouping.root_clades = root_clades

        return new_grouping

    
    def extract_conservation_scores(self):
        # okay, this could surely be modified to hit only the 'columns' table instead of rows and columns
         
        seq_list = self.rows.values_list('sequence', flat=True)
        seq_weights = calculate_sequence_weights(seq_list)
        
        cols = self.columns.order_by('num')
        scores = window_score([conservation(col.sequence, seq_weights) for col in cols])
    
        for col, score in izip(cols, scores):
            cons = Conservation(column=col, score=score, pending=False)
            cons.save()

        
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


class Clade(models.Model):
    alignment = models.ForeignKey(Alignment, related_name='clades', db_index=True)
    num = models.IntegerField(editable=False)
    cumulative_branch_length = models.FloatField(default=0.0, editable=False)
    local_branch_length = models.FloatField(editable=False)
    row = models.OneToOneField(Row, null=True)               # leaf nodes only
    parent = models.ForeignKey('self', null=True, related_name='children')


# use django-mptt to manage tree structure of Clades. Possibly this should be in __init__.py?
try:
    mptt.register(Clade, order_insertion_by=["num"])
except mptt.AlreadyRegistered:
    pass


class ThresholdGrouping(models.Model):

    alignment = models.ForeignKey(Alignment, related_name='threshold_groupings')
    root_clades = models.ManyToManyField(Clade, related_name='threshold_groupings')
    threshold = models.FloatField()


class RowGroup(models.Model):
    
    # issue. Would like to have a 'Group' table against which to score relatedness. 
    # ThresholdGroupings are currently
    # essentially the same as Clades. But other groupings will be specified differently...
    
    # solution. 
    # 1. create the 'RowGroup' model
    # 2. for each type of row group (threshold group, column-sorted group), create a model with a one-to-one
    #    relationship with RowGroup. This model contains the uniquely specifying info for that group (i.e.,
    #    the root clade for a threshold_group; a M2M field on Rows for manual-sort groups, etc.)
    # 3. Possibly include an M2M relationship with Rows in RowGroup model -- but notice this is a sort
    #    of denormalization (the augmenting model should contain the methods necessary to calculate the rows)
    # 4. Update Alignment.get_threshold_grouping, ThresholdGrouping (which should now point to RowGroups
    #    instead of Clades), and the Piston resources that return groupings
    
    pass
    

class UniqueColumnScore(models.Model):
    
    column = models.OneToOneField(Column, db_index=True)
    score = models.FloatField(null=True)               # null -> not calculated for this col (too many gaps)
    pending = models.BooleanField()                    # whether the calculation's value is available yet
    
    class Meta:
        abstract = True


class Conservation(UniqueColumnScore):

    pass

    
class RelatednessScore(models.Model):
    
    related_column = models.ForeignKey(Column)
    value = models.FloatField(null=True)
    pending = models.BooleanField()
    
    def save(self, *args, **kwargs):
        if (column1.alignment != column2.alignment):
            return              # FIXME what exception should this raise?
        super(Relatedness, self).save(*args, **kwargs)
    
    class Meta:
        unique_together = ('subject', 'related_column')
        abstract = True
        

class ColumnRelatedness(RelatednessScore):
    
    subject = models.ForeignKey(Column, db_index=True, related_name='relatedness_scores')
    

class CladeRelatedness(RelatednessScore):
    
    subject = models.ForeignKey(Clade, db_index=True, related_name='relatedness_scores')


class RowGroupRelatedness(RelatednessScore):

    subject = models.ForeignKey(RowGroup, db_index=True, related_name='relatedness_scores')



### forms ###



class BaseAlignmentForm(ModelForm):

    class Meta:
        model = Alignment
        exclude = ['newick_tree']


class CreateAlignmentForm(BaseAlignmentForm):

    def clean(self):
        """
        # 1. validates that, if there is no local_file, that source_url downloads okay (placing contents in
             cleaned_data['remote_url_contents'])
        # 2. validates that the resulting file, whether a local file or the contents of remote url, parses
             correctly
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
            # remember always to return cleaned_data; field validation will have already supplied the required
            # error messages here
            return cleaned_data

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
        exclude = ['source_url', 'local_file', 'format', 'newick_tree']
