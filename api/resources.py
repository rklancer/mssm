from piston.resource import Resource
from piston.authentication import HttpBasicAuthentication, NoAuthentication

from noraseq.api.handlers import * 
from noraseq.views import dummy


#auth = HttpBasicAuthentication(realm='NORASeq API')
auth = NoAuthentication


# alignment basics

#alignment_base = dummy
alignment_base = Resource(AlignmentBase)
alignment_table = Resource(Table)
row_list = dummy
column_list = dummy


# tree and threshold

tree = dummy
clade = dummy
threshold_grouping_list = Resource(ThresholdGroupingList)
threshold_group_list = Resource(ThresholdGroupList)
threshold_group = Resource(ThresholdGroup)


# sorted alignments

sorted_alignment_index = dummy    # contains form for POSTing new manual sort or GETting new sort-col sort

column_sorted_base = Resource(ColumnSortedBase)
column_sorted_table = Resource(ColumnSortedTable)
column_sorted_group_list = Resource(ColumnSortedGroupList)
column_sorted_group = Resource(ColumnSortedGroup)

column_sorted_base_redirector = dummy
column_sorted_table_redirector = Resource(ColumnSortedTableRedirector)

manual_sorted_base = dummy
manual_sorted_table = dummy
manual_sorted_group_list = dummy
manual_sorted_group = dummy


# alignment elements and their associated metadata

cell = dummy
comment_on_cell = dummy
tag_list_for_cell = dummy

row = Resource(RowResource)
name_of_row = dummy
comment_on_row = Resource(CommentOnRow)
tags_for_row = dummy

column = dummy
comment_on_column = dummy
tags_for_column = dummy


# statistics

pair_correlations = dummy         # takes query parameters 'bins', 'bin', 'start', 'num'
column_correlations = dummy       # take query parameter 'url' identifying a column, tag, group, or clade
conservation_statistics = dummy
size_statistics = dummy
charge_statistics = dummy


# tags

row_scoped_tag_list = dummy
row_scoped_tag = dummy
tags_for_row_list = dummy

column_scoped_tag_list = dummy
column_scoped_tag = dummy
tags_for_column_list = dummy

cell_scoped_tag_list = dummy
cell_scoped_tag = dummy
tags_for_cell_list = dummy

current_tag_mapping = dummy


# comments

row_scoped_comment_list = dummy
column_scoped_comment_list = dummy
cell_scoped_comment_list = dummy
current_comment_mapping = dummy

