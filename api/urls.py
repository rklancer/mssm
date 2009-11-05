from django.conf.urls.defaults import *
from django.views.generic.simple import redirect_to
from noraseq.views import dummy
from noraseq.api.handlers import AlignmentBase

from piston.resource import Resource
from piston.authentication import HttpBasicAuthentication, NoAuthentication


#auth = HttpBasicAuthentication(realm='NORASeq API')
auth = NoAuthentication

# we'll go with the convention that url patterns below are directed to callables with the name of the 
# corresponding resource.

# these callables can be custom Django views imported here
# or they can be created by the Piston convention
#   resource_callable = Resource(ResourceHandlerClass)

# resources

# alignment basics

#alignment_base = dummy
alignment_base = Resource(AlignmentBase)
alignment_table = dummy
row_list = dummy
column_list = dummy


# tree and threshold

tree = dummy
clade = dummy
threshold_grouping_list = dummy
threshold_group_list = dummy
threshold_group = dummy


# sorted alignments

sorted_alignment_index = dummy    # contains form for POSTing new manual sort or GETting new sort-col sort

column_sorted_base = dummy
column_sorted_table = dummy
column_sorted_group_list = dummy
column_sorted_group = dummy

manual_sorted_base = dummy
manual_sorted_table = dummy
manual_sorted_group_list = dummy
manual_sorted_group = dummy


# alignment elements and their associated metadata

cell = dummy
comment_on_cell = dummy
tag_list_for_cell = dummy

row = dummy
name_of_row = dummy
comment_on_row = dummy
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


# urls

threshold_grouping_urls = patterns('',
    (r'^$', threshold_grouping_list),
    (r'^(?P<grouping_id>\d+/)$', threshold_group_list),
    (r'^(?P<grouping_id>\d+/)/group/(?P<group_id>\d+)/$', threshold_group),
)


column_sorted_urls = patterns('',
    (r'^$', column_sorted_base),
    (r'^table/$', column_sorted_table),
    (r'^groups/$', column_sorted_group_list),
    (r'^group/(?P<group_pattern>[-acdefghiklmnpqrstvwyACDEFGHIKLMNPQRSTVWY]+)/$', column_sorted_group),
)


manual_sorted_urls = patterns('',
    (r'^$', manual_sorted_base),
    (r'^table/$', manual_sorted_table),
    (r'^groups/$', manual_sorted_group_list),
    (r'^group/(?P<group_id>\d+)/$', manual_sorted_group),
)


cell_urls = patterns('',
    (r'^$', cell),
    (r'^comment/$', comment_on_cell),
    (r'^tags/$', tag_list_for_cell),
)

canonical_cell_url_template = '/api/v1/alignment/%(alignment_id)s/row/%(row_id)s/column/%(column_id)s/'

# these should redirect to the canonical cell urls above
noncanonical_cell_urls = patterns('',
    (r'^$', redirect_to, {'url' : canonical_cell_url_template }),
    (r'^comment/$', redirect_to, {'url' : canonical_cell_url_template + 'comment/'}),
    (r'^tags/$', redirect_to, {'url' : canonical_cell_url_template + 'tags/'}),
)


row_urls = patterns('',
    (r'^$', row),
    (r'^name/$', name_of_row),
    (r'^comment/$', comment_on_row),
    (r'^tags/$', tags_for_row),
    (r'^column/(?P<column_id>\d+)/', include(cell_urls)),
)


column_urls = patterns('',
    (r'^$', column),
    (r'^comment/$', comment_on_column),
    (r'^tags/$', tags_for_column),
    (r'^row/(?P<row_id>\d+)/', include(noncanonical_cell_urls)),
)


statistic_urls = patterns('',
    (r'^conservation/', conservation_statistics),
    (r'^size/', size_statistics),
    (r'^charge/', charge_statistics),
)


tag_mapping_urls = patterns('',
    (r'^$', current_tag_mapping),
    #(r'^(?P<mapping_id>\d+)/$', versioned_tag_mapping),
    #(r'^excluded/$', excluded_tag_mapping_list),
    #(r'^excluded/new/$', excluded_tag_mapping_generator),
    #(r'^excluded/(?P<excluded_mapping_id>\d+)/', excluded_tag_mapping),
)


tag_urls = patterns('',
    (r'^row/$', row_scoped_tag_list),
    (r'^rows/(?P<row_ids>[\d;]+)/$', tags_for_row_list),
    (r'^column/$', column_scoped_tag_list),
    (r'^columns/(?P<column_ids>[\d;]+)/$', tags_for_column_list),
    (r'^cell/$', cell_scoped_tag_list),
    (r'^cells/(?P<cell_ids>(?:\d+,\d+;)*\d+,\d+)/$', tags_for_cell_list),
    (r'^mapping/', include(tag_mapping_urls)),
)


comment_mapping_urls = patterns('',
    (r'^$', current_comment_mapping),
    #(r'^(?P<mapping_id>\d+)/$', versioned_comment_mapping),
    #(r'^excluded/$', excluded_comment_mapping_list),
    #(r'^excluded/new/$', excluded_comment_mapping_generator),
    #(r'^excluded/(?P<excluded_mapping_id>\d+)/', excluded_comment_mapping),
)


comment_urls = patterns('', 
    (r'^row/$', row_scoped_comment_list),
    (r'^column/$', column_scoped_comment_list),
    (r'^cell/$', cell_scoped_comment_list),
    (r'^mapping/', include(comment_mapping_urls)),
)


alignment_urls = patterns('',
    (r'^$', alignment_base),
    (r'^tree/$', tree),
    (r'^tree/threshold-grouping/', include(threshold_grouping_urls)),
    (r'^tree/clade/(?P<clade_id>\d+)/$', clade),
    (r'^table/$', alignment_table),
    (r'^sorted/$', sorted_alignment_index),
    (r'^sorted/by-columns/(?P<sort_cols>[\d/]+)/', include(column_sorted_urls)),
    (r'^sorted/manual/(?P<sort_id>\d+)/', include(manual_sorted_urls)),
    (r'^correlations/all-pairs/$', pair_correlations),
    (r'^correlations/by-column/$', column_correlations),
    (r'^rows/$', row_list),
    (r'^row/(?P<row_id>\d+)/', include(row_urls)),
    (r'^columns/$', column_list),
    (r'^columns/statistics/', include(statistic_urls)),
    (r'^column/(?P<column_id>\d+)/', include(column_urls)),
    (r'^tags/', include(tag_urls)),
    (r'^tag/row/(?P<tag>[-\w]+)/$', row_scoped_tag),
    (r'^tag/column/(?P<tag>[-\w]+)/$', column_scoped_tag),
    (r'^tag/cell/(?P<tag>[-\w]+)/$', cell_scoped_tag),
    (r'^comments/', include(comment_urls)),
)


urlpatterns = patterns('',
    (r'^alignment/(?P<alignment_id>\d+)/', include(alignment_urls)),
)


resources = """
alignment:
    alignment

tree:
    tree

each clade in a tree:
    clade

the grouping (= set of groups) induced by a particular threshold (redirect to this from ?t=0.23):
    threshold_grouping

each individual group in a grouping (set of rows)
    row_group

alignment table (sorted or not)
    table

the set of groups associated with a sorted alignment
    sort_grouping

the set of groups associated with a manually-sorted alignment
    manual_grouping

the set of correlations between all pairs of columns

the set of correlations between all columns and a particular column or set of rows (identified by url in query param)

the set of all rows

a row

    (we won't give a separate uri for the name or other metadata of a row)
the comment on a row

the tags applied to a row

the set of cells (identified by column) in a particular row

a cell

the comment on a cell

the tags applied to a cell

the set of all columns

the set of all cells in a column (identified by row; note these redirect in the hierarchy to /row/m/column/n/)

the set of all currently defined tags for rows

the tags in common among a given set of rows (accepts PUT, DELETE)

the set of all currently defined tags for columns

the tags in common among a given set of cells (accepts PUT, DELETE)

the set of all currently defined tags for cells

the *current* mapping between tags and alignment items (rows, columns, and cells; redirects to a versioned mapping)

a *versioned* (numbered) mapping mapping between tags and alignment items

the list of all excluded mappings between tags and alignment items (see above for explanation)

a resource for generating new "excluded mappings" between tags and alignment items

a particular "excluded mapping" between tags and alignment items (redirects to a versioned mapping)

a particular row tag (mainly, the rows associated with it)

a particular column tag (mainly, the columnss associated with it)

a particular cell tag (mainly, the cells associated with it)

all comments

all comments associated with a row          (GET only)

all comments associated with a column       (GET only)

all comments associated with a cell         (GET only)

the current mapping from alignment items to comments (redirects to a versioned mapping)

a particular version of the mapping from alignment items to comments

the list of "excluded mappings" from alignment items to comments

a particular "excluded mapping" from alignment items to comments


... and that's it.

"""

urls = r"""
/api/v1/
    alignment/(\d+)/
        tree/
            threshold-grouping/
                (\d+)/
                    /groups/
                    /group/(\d+)/
            clade/(\d+)/
        table/
        sorted/
            by-columns/
                (\d+/)+/
                    table/
                    groups/
                    group/([-acdefghiklmnpqrstvwyACDEFGHIKLMNPQRSTVWY]/]+)
            manual/
                (\d+)/
                    table/
                    groups/
                    group/(\d+)/
        correlations/
            all-pairs/?bins=200&bin=3&start=1&num=100
            by-column/?target=(url of target clade/tag/group/column) (provide convenient list)
        rows/
        row/(\d+)/
            name/
            comment/
            tags/
            column/(\d+)/
                comment/
                tags/
        columns/
            row/(\d+)/  (-> redirects to /row/m/column/n/ )
            statistic/
                conservation/
                size/
                charge/
        column/(\d+)/
            comment/
            tags/

        tags/
            row/                (-> list of /tag/row/([-\w]+)/
            rows/([\d;]+)/
            column/
            columns/([\d;]/            
            cell/
            cells/((?:\d+,\d+;)+\d+,\d+)/
            mapping/
                (\d+)/
                excluded/
                    new/
                    (\d+)/
        tag/
            row/([-\w]+)/
            column/([-\w]+)/
            cell/([-\w]+)/


        comments/
            row/
            column/
            cell/
            mapping/
                (\d+)/
                excluded/
                    new/
                    (\d+)/
"""