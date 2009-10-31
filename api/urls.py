from django.conf.urls.defaults import *

from django.conf.urls.defaults import *

# we'll go with the convention that url patterns below are directed to callables with the name of the 
# corresponding resource.

# these callables can be custom Django views imported here
# or they can be created by the Piston convention
#   resource_callable = Resource(ResourceHandlerClass)

# think carefully about the resource names before plunging ahead

alignment = lambda : None     # i.e., define each alignment as a callable
tree = ()


# url patterns here. Use the include pattern below as needed.

alignment_urls = patterns('',
    (r'tree', tree),
    (r'tree/threshold-grouping/', tree_grouper),
    (r'tree/threshold-grouping/(?P<group_id>\d+/)', tree_grouping),
)

    
urlpatterns = patterns('',
    (r'alignment/(?P<alignment_id>\d+)/', include(alignment_urls)),
)


"""
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
            (c\d+/)+
                table/
                groups/
                group/([-acdefghiklmnpqrstvwyACDEFGHIKLMNPQRSTVWY]/]+)
            (\d+)/
                table/
                groups/
                group/(\d+)/
        correlations/
            column-pairs/

        row/(\d+)/
            comment/
            tags/
            column/(\d+)/
                comment/
                tags/
        columns/
            statistic/
                conservation/
                size/
                charge/
        column/(\d+)/
            comment/
            tags/
        tags/
            row/
            column/
            cell/
            mapping/
                by-class/
                by-tag/
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
                by-class/
                excluded/
                    new/
                    (\d+)/
"""