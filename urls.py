from django.conf.urls.defaults import *
from django.conf import settings

urlpatterns = patterns(settings.PROJECT_NAME + '.mssm.views',
    (r'^$', 'index'),
    (r'^deleted/$', 'deleted'),
    (r'^alignments/$','alignment_list'),
    (r'^alignment/(\d+)/$', 'alignment_detail')
)


"""
/api/
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

