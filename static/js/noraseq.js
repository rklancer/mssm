var appstate = (function () {

    var that = {};
    
    /* new_url_backed_instance(args):

       Create object with "loaded", "error", "urL" properties to object; try to load it from args.url; handle
       retry logic (and redirection logic?) as necessary. Callback to (object).seturl_success() when we have
       data; callback (object).seturl_error() when we decide to give up retrying. Also endow object with
       cancel_loading() method */

    var new_url_backed_instance = function (args) {

        var that = {};

        var propmgr = tstate.add_property_manager(that);

        args.secrets.property_manager = propmgr;
        propmgr.add("url", "loaded", "error");

        var set = propmgr.set;
        var url = args.url || null;

        var xhr;

        set("loaded", false);
        set("error", false);
        set("url", args.url);

        if (url) {
            var handle_success = function (response, status) {
                // implement redirection logic here if needed
                set("loaded", true);
                that.seturl_success(response, status);
            };

            var handle_error = function (xhr, status, err) {
                // implement retry logic here

                if (!that.get("loaded")) {
                    set("error", true);
                    that.seturl_error(xhr, status, err);
                }
            };
        }
        
        that.load = function () {
            xhr = $.ajax({
                url: url,
                success: handle_success,
                error: handle_error,
                dataType: args.data_type
            });
        };
        
        that.cancel_loading = function () {
            if (xhr) {
                xhr.abort();
            }
        };

        return that;
    };


    var new_url_backed_container = function (instance_constructor) {

        var that = {};

        var propmgr = tstate.add_property_manager(that);
        var set = propmgr.set;

        propmgr.add("instance");

        that.set_instance_url = function (url) {
            url = url || null;

            var instance = that.get("instance");
            var instance_url = instance ? instance.get("url") : undefined;

            if (url !== instance_url) {
                if (instance) {
                    instance.cancel_loading();
                }
                set("instance", instance_constructor(url));
            }
        };

        return that;
    };


    var new_base_instance = function (url) {

        // Representation of the single point for updating alignment info, requesting sorted versions
        // Like a "main menu". Linked from the resources that actually contain alignment data.

        var secrets = {};

        var that = new_url_backed_instance({
            url: url,
            secrets: secrets
        });

        var propmgr = secrets.property_manager;


        that.seturl_success = function (html, status) {
            var jq_base = $(html);
            
            global_jq_base = jq_base;
            console.log("tree url: " + jq_base.find("a[rel='tree']").attr("href"));
            console.log("seq-table: " + jq_base.find("a[rel='seq-table']").attr("href") );

            //tstate("tree").set_instance_url( jq_base.find("a[rel='tree']").attr("href") );
            //tstate("seq-table").set_instance_url( jq_base.find("a[rel='seq-table']").attr("href") );

            /* If the server provides a *link* to a groups_def, that means it has determined the grouping
               to use, and we should pass the url to the groups_def object. If the server provides a
               *form* (with class "form.groups-def-request"), the server is providing a facility for
               requesting a grouping based on some parameter(s) (specified by an additional class)-- so
               pass the form along to the groups_def object.*/

            var grplink = jq_base.find("a[rel='groups-def']");
            if (grplink.length > 0) {
                var g=grplink;
                console.log("set grplink");
                /*tstate("seq-table.instance.groups-def").set_source({
                    type: "url",
                    url: grplink.attr("href")
                });*/
            }
            else {
                var f = jq_base.find("form.groups-def-request.threshold-request");
                console.log("set threshold groups def url");
                // note the use of 2 classes: groups-def-request AND the refinement "threshold-request"
                /*tstate("seq-table.instance.groups-def").set_source({
                    type: "threshold",
                    form: jq_base.find("form.groups-def-request.threshold-request")
                });*/
            }
        };


        that.seturl_error = function (xhr, status, err) {
            console.log("error: new_base_instance() ajax call returned error, url = " + url);
        };

        that.load();
        
        
        return that;
    };
    

    var new_selected_elements = function () {

        var that = {};

        var propmgr = tstate.add_property_manager(that);
        var set = propmgr.set;
        propmgr.add("rows", "cols", "cells");


        var new_element_set = function () {

            var that = {};
            var propmgr = tstate.add_property_manager(that);
            var set = propmgr.set;
            propmgr.add("serialized", "added", "removed");

            set("serialized", "");
            set("added", []);
            set("removed", []);

            var elements = {};


            var list_to_dict = function (list) {
                var dict = {};

                for (var i = 0; i < list.length; i++) {
                    dict[list[i]] = true;
                }

                return dict;
            };


            var dict_to_list = function (dict) {
                var list = [];
                var item;

                for (item in dict) {
                    if (dict.hasOwnProperty(item)) {
                        list.push(item);
                    }
                }
                return list;
            };


            var subtract = function (first, second) {
                var item;
                var first_minus_second = [];

                for (item in first) {
                    if (first.hasOwnProperty(item)) {
                        if (!second[item]) {
                            first_minus_second.push(item);
                        }
                    }
                }

                return first_minus_second;
            };


            // set "added" and "removed" but avoid setting "serialized"
            var set_to = function (new_elts) {
                var old_elements = elements;
                elements = list_to_dict(new_elts);

                var added = subtract(elements, old_elements);
                var removed = subtract(old_elements, elements);

                set("added", added);
                set("removed", removed);

                return ((added.length + removed.length) > 0);
            };


            // uses a pretty trivial serialization-deserialization protocol: commas!
            var serialize = function () {
                return dict_to_list(elements).join(",");
            };


            var deserialize = function (s) {
                s = s.toString();           // if s has no commas it may be passed in as a number
                that.set_to(s.split(","));
            };


            that.set_to = function (new_elts) {
                var changed = set_to(new_elts);
                if (changed) {
                    set("serialized", serialize());
                }
            };


            that.add = function (new_elts) {
                var added = [];
                var item;

                for (var i = 0; i < new_elts.length; i++) {
                    item = new_elts[i];

                    if (!elements[item]) {
                        elements[item] = true;
                        added.push(item);
                    }
                }

                if (added.length > 0) {
                    set("added", added);
                    //could change sense of "removed" to be "most recently removed" (& then remove next line:)
                    set("removed", []);     
                    set("serialized", serialize());
                }
            };


            that.remove = function (to_remove) {
                var removed = [];
                var item;

                for (var i = 0; i < to_remove.length; i++) {
                    item = to_remove[i];

                    delete elements[item];
                    removed.push(item);
                }

                if (removed.length > 0) {
                    set("removed", removed);
                    set("added", []);
                    set("serialized", serialize());
                }
            };


            that.as_list = function () {
                return dict_to_list(elements);
            };


            // let serialized be a read/write property for the sake of simplicty of history mechanism

            propmgr.setter("serialized", function (s) {
                deserialize(s);
            });


            return that;
        };


        set("rows", new_element_set());
        set("cols", new_element_set());
        set("cells", new_element_set());


        return that;
    };

    that.init = function () {

        var root = {};

        var propmgr = tstate.add_property_manager(root);
        propmgr.add("selected", "base");
        var set = propmgr.set;

        global_pm = propmgr;
        global_new_base = new_base_instance;
        
        set("selected", new_selected_elements());
        set("base", new_url_backed_container(new_base_instance));
        tstate.root(root);                          // now tstate("tree") = tree as defined above, etc.
    };


    return that;
}());


$(document).ready(function() {
    
    appstate.init();
    
    tstate("base").set_instance_url(BASE_URL);
    
    $("#stats-panel").tabs();
    
    $('#stats-panel ul.ui-tabs-nav a').click(function(){
        var idx = $(this).parent().prevAll().length;
        $.bbq.pushState({'stats-panel': idx});
        return false;
    });

    $(window).bind('hashchange', function (e) {
        $('#stats-panel').each(function(){
            var idx = $.bbq.getState(this.id, true) || 0;
            $(this).tabs('select', idx);
        });
    });
    $(window).trigger('hashchange');
    
    $("#column-labels-table").mouseover( function (e) {
        var th = $(e.target).closest("th");
        var col_class_selector = "."+th.attr("className").match(/\b(c\d+)\b/)[1];
        var col = $(col_class_selector);
        
        col.addClass("hovered");
        th.bind("mouseout.noraseq-hover", function () {
            col.removeClass("hovered");
            th.unbind("mouseout.noraseq-hover");
        });
    });
    
    
    $("#column-labels-table").click( function (e) {
        var col_class = $(e.target).attr("className").match(/\b(c\d+)\b/)[1];
        var col_num = col_class.substring(1,col_class.length)*1;
        
        if ($("."+col_class).hasClass("selected")) {
            tstate("selected.cols").remove([col_num]);
        }
        else {
            tstate("selected.cols").add([col_num]);
        }
    });

    tstate("selected.cols.added").on_change(function (added) {
        var n_added = added.length;
        for (var i = 0; i < n_added; i++) {
            $(".c" + added[i]).addClass("selected");
        }            
    });
    
    tstate("selected.cols.removed").on_change(function (removed) {
        var n_removed = removed.length;
        for (var i = 0; i < n_removed; i++) {
            $(".c" + removed[i]).removeClass("selected");
        }
    });

    
    tstate("selected.cols.serialized").hist("scol");

    $("#row-label-panel").resizable({'helper': 'ui-state-highlight'});
    
    safely_size_overflow_containers();
});


/* safely_size_overflow_containers():

  Call size_overflow_containers(), but make sure to do it while #sequence-table is display: none because
  resizing any divs containing the large sequence-table is a very slow operation in Firefox.
  
   Note that in order for this strategy to work, we need to pause between hiding #sequence-table and resizing
  any divs that contain it; similarly we need to pause to allow the div resizing to finish processing before
  we show #sequence-table again.
*/

var safely_size_overflow_containers = function () {
    var time_step = 50;
    var sequence_table = $("#sequence-table");
    var table_parent = sequence_table.closest(".scrolling-content");
    var table_height = sequence_table.height();
    var table_width = sequence_table.width();

    timeout(time_step, function () {
        sequence_table.hide();
        timeout(time_step, function () {
            table_parent.height(table_height).width(table_width);
            size_overflow_containers();
            timeout(time_step, function () {
                sequence_table.show();
            });
        });
    });
};


/* size_overflow_containers: 

  Call this to resize the overflow containers such that the content within them can always be scrolled
  to the very bottom (for .y-overflow-containers) or to the far right (for .x-overflow-containers.)

  scheme is this:
  
  <div class="x-overflow-container">
    <div class="scolling-panel">         <!-- must be immediate child of x-overflow-container) -->
      <div class="scrolling-content">      <!-- must be immediate child of scrolling-panel -->
        (content to be scrolled left/right)
      </div>
    </div>
  </div>
  
  This function assumes a maximum size for the .x-overflow-container (it's assumed to be no wider than the
  monitor size. Still need to write the mechanism that sets a larger maximum size if the viewport is ever
  enlarged larger than the monitor size.)
  
   Then it resizes the x-scrolling-panel so that it is the width of the contained content plus the width of
  the .x-overflow-container it's in. (Similarly, it resizes y-scrolling-panels such that they are the height
  of the content plus the container.)
  
   This ensures that the content can be scrolled up from the point at which the content left edge overlaps the
  left edge of the overflow container, to the point at which the content's *right edge* overlaps the left edge
  of the overflow container. (For y-scrolling case, substitute "top" for "left" and "bottom" for "right".)
  
   NOTE the size of the content to be scrolled should never change; this function examines the original height
  and width of the content and caches them before it modifies the .x(y)-overflow-container sizes; subsequent
  calls use the cached values. This is necessary because in the case of an x-overflow-container nested in a
  y-overflow-container, or vice versa, the function will modify the apparent height or width of the inner
  container making it impossible in general to know how to add up the dimensions of the content that is
  enclosed by the outer container, but not the inner, with the dimensions of the content that is enclosed by
  both containers.
 
*/
  
  
var size_overflow_containers = function () {

    var orig_height, orig_width;
    var content, panel;

    // fixme:
    // eventually want to re-verify these on window resize
    // (plus obviously we'll remove these hard-coded values)
    
    var max_width = 1920;
    var max_height = 1200;

    
    $(".y-overflow-container, .x-overflow-container").each( function () {          
        panel = $(this).children(".scrolling-panel"); 
        content = panel.children(".scrolling-content");
        
        if (!content.data("orig_height")) {
            content.data("orig_height", content.height());
            content.data("orig_width", content.width());
        }
                
        orig_height = content.data("orig_height");
        orig_width = content.data("orig_width");        
        
        if ($(this).hasClass(".y-overflow-container")) {
            panel.height(max_height + orig_height);
            $(this).height(max_height);

            panel.width(orig_width);
            $(this).width(orig_width);
        } 
        else if ($(this).hasClass(".x-overflow-container")) {            
            panel.height(orig_height);
            $(this).height(orig_height);
        
            panel.width(max_width + orig_width);
            $(this).width(max_width);
        }
    });
};


var timeout = function(t, f) {
     window.setTimeout(f, t);
};

