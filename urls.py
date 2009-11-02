from django.conf.urls.defaults import *
from noraseq.views import index, deleted, alignment_list, alignment_detail

alignment_urls = patterns('', 
    (r'^$', alignment_detail),
)

urlpatterns = patterns('',
    (r'^$', index),
    (r'^deleted/$', deleted),
    (r'^alignments/$', alignment_list),
    (r'^alignment/(?P<alignment_id>\d+)/', include(alignment_urls)),
    (r'^api/v1/', include('noraseq.api.urls'))
)


