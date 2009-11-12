from django.conf.urls.defaults import *
from noraseq.views import index, deleted, alignment_list, alignment_detail, noraseq_viewer
from noraseq.noraseq_css import css

alignment_urls = patterns('', 
    (r'^$', alignment_detail),
    (r'^viewer/', noraseq_viewer),
)

urlpatterns = patterns('',
    (r'^$', index),
    (r'^deleted/$', deleted),
    (r'^alignments/$', alignment_list),
    (r'^alignment/(?P<alignment_id>\d+)/', include(alignment_urls)),
    (r'^api/v1/', include('noraseq.api.urls')),
    (r'^css/(?P<css_file_name>\w+\.css)', css),
)


