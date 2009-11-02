from django.conf.urls.defaults import *
from noraseq.views import dummy

# we'll go with the convention that url patterns below are directed to callables with the name of the 
# corresponding resource.

# these callables can be custom Django views imported here
# or they can be created by the Piston convention
#   resource_callable = Resource(ResourceHandlerClass)

# think carefully about the resource names before plunging ahead.

# url patterns here. Use the include pattern below as needed.


threshold_grouping_urls = patterns('',
    (r'^$', dummy),
    (r'^(?P<grouping_id>\d+/)$', dummy),
    (r'^(?P<grouping_id>\d+/)/groups/$', dummy),
    (r'^(?P<grouping_id>\d+/)/group/(\d+)/$', dummy),
)


column_sorted_urls = patterns('',
    (r'^$', dummy),
    (r'^table/$', dummy),
    (r'^groups/$', dummy),
    (r'^group/(?P<group_pattern>[-acdefghiklmnpqrstvwyACDEFGHIKLMNPQRSTVWY]+)/$', dummy),
)


manual_sorted_urls = patterns('',
    (r'^$', dummy),
    (r'^table/$', dummy),
    (r'^groups/$', dummy),
    (r'^group/(?P<group_id>\d+)/$', dummy),
)


cell_urls = patterns('',
    (r'^^$', dummy),
    (r'^comment/$', dummy),
    (r'^tags/$', dummy)
)

# these should redirect to the canonical cell urls above
noncanonical_cell_urls = patterns('',
    (r'^^$', dummy),
    (r'^comment/$', dummy),
    (r'^tags/$', dummy)
)


row_urls = patterns('',
    (r'^^$', dummy),
    (r'^name/$', dummy),
    (r'^comment/$',dummy),
    (r'^tags/$',dummy),
    (r'^column/(?P<column_id>\d+)/', include(cell_urls)),
)


column_urls = patterns('',
    (r'^^$', dummy),
    (r'^name/$', dummy),
    (r'^comment/$',dummy),
    (r'^tags/$',dummy),
    (r'^column/(?P<column_id>\d+)/', include(noncanonical_cell_urls)),
)


statistic_urls = patterns('',
    (r'^conservation/', dummy),
    (r'^size/', dummy),
    (r'^charge/', dummy),
)


tag_mapping_urls = patterns('',
    (r'^$', dummy),
    (r'^(?P<mapping_id>\d+)/$', dummy),
    (r'^excluded/$', dummy),
    (r'^excluded/new/$', dummy),
    (r'^excluded/(?P<excluded_mapping_id>\d+)/', dummy),
)


tag_urls = patterns('',
    (r'^row/$', dummy),
    (r'^rows/(?P<row_ids>[\d;]+)/$', dummy),
    (r'^column/$', dummy),
    (r'^columns/(?P<column_ids>[\d;]+)/$', dummy),
    (r'^cell/$', dummy),
    (r'^cells/(?P<cell_ids>(?:\d+,\d+;)*\d+,\d+)/$', dummy),
    (r'^mapping/$', dummy),
)


comment_mapping_urls = patterns('',
    (r'^$', dummy),
    (r'^(?P<mapping_id>\d+)/$', dummy),
    (r'^excluded/$', dummy),
    (r'^excluded/new/$', dummy),
    (r'^excluded/(?P<excluded_mapping_id>\d+)/', dummy),
)


comment_urls = patterns('', 
    (r'^row/$', dummy),
    (r'^column/$', dummy),
    (r'^cell/$', dummy),
    (r'^mapping/', include(comment_mapping_urls)),
)


alignment_urls = patterns('',
    (r'^^$', dummy),
    (r'^tree/$', dummy),
    (r'^tree/threshold-grouping/', include(threshold_grouping_urls)),
    (r'^tree/clade/(?P<clade_id>\d+)/$', dummy),
    (r'^table/$', dummy),
    (r'^sorted/$', dummy),
    (r'^sorted/by-columns/(?P<sort_cols>[\d/]+)/', include(column_sorted_urls)),
    (r'^sorted/manual/(?P<sort_id>\d+)/', include(manual_sorted_urls)),
    (r'^correlations/all-pairs/$', dummy),
    (r'^correlations/by-column/$', dummy),
    (r'^rows/$', dummy),
    (r'^row/(?P<row_id>\d+)/', include(row_urls)),
    (r'^columns/$', dummy),
    (r'^columns/statistics/', include(statistic_urls)),
    (r'^column/(?P<column_id>\d+)', include(column_urls)),
    (r'^tags/', include(tag_urls)),
    (r'^tag/row/(?P<tag>[-\w]+)/$', dummy),
    (r'^tag/column/(?P<tag>[-\w]+)/$', dummy),
    (r'^tag/cell/(?P<tag>[-\w]+)/$', dummy),
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