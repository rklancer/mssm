if(typeof(console) === "undefined" || typeof(console.log) === "undefined") {
    var console = { log: function() { } };
}

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
        var handle_success, handle_error;
        var xhr, canonical_url;

        set("loaded", false);
        set("error", false);
        set("url", args.url);

        if (url) {
            handle_success = function (response, status) {
                set("loaded", true);
                
                // the server may inform us of the canonical url, which may not be the url we requested
                // (because of redirects). By setting "url" to this value, we can avoid an unnecessary reload
                // if url_backed_container.set_instance_url is ever called with the canonical url
                
                canonical_url = xhr.getResponseHeader('Content-Location');
                if (canonical_url && (canonical_url !== url)) {
                    set("url", canonical_url);
                }
                
                console.log("url_backed_instance base class about to call that.seturl_success()");
                that.seturl_success(response, status);
            };

            handle_error = function (xhr, status, err) {
                // implement retry logic here

                if (!that.get("loaded")) {
                    set("error", true);
                    that.seturl_error(xhr, status, err);
                }
            };
        }
        
        that.load = function () {
            if (url) {
                xhr = $.ajax({
                    url: url,
                    success: handle_success,
                    error: handle_error,
                    dataType: args.data_type
                });
            }
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
            tstate("seq-table").set_instance_url( jq_base.find("a[rel='seq-table']").attr("href") );

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
            tstate("seq-table").set_instance_url(null);
        };

        that.load();
        
        
        return that;
    };
    
    
    var new_seq_table_instance = function (url) {

        /* Some quick Firebug experimentation suggests passing a ~1M string around between javascript
           methods/functions is no problem at all. So we'll stick to always building the new table on the
           server side--for now.

           However, we want to be able to modify the system at a later date to accomodate 2 performance
           improvements:
               1. Send JSON, once, for table; construct <table> html on client side; and let server just
                  pass a data structure representing how to sort the JSON
               2. Actually sort the JSON client side, without reporting back to the server, each time
                  user requests a sort on the sort_cols.
        */

        var secrets = {};
        var that = new_url_backed_instance({
            url: url,
            secrets: secrets
        });

        var propmgr = secrets.property_manager;
        var set = propmgr.set;

        propmgr.add("table", "groups-def", "row-label-table");
        //set("groups-def", new_groups_def());

        var sort_form;
        var unsorted_table_url;

        
        that.seturl_success = function (response, status) {
            var jq_doc = $(response);
            var jq_table = jq_doc.find("table.seq-table");

            var row_label_table = $("<table id='row-labels-table'><tbody></tbody></table>");
            var body = row_label_table.find("tbody");
            
            jq_table.find("tr").each(function () {
                // do these clones one-by-one, rather than doing jq_table.find('tr').clone().(...)
                var tr_clone = $("<tr></tr>");
                var td = $(this).find("td:first-child").clone()
                tr_clone.append(td);
                tr_clone.addClass($(this).attr("className"));
                body.append(tr_clone);
            });
                
            set("row-label-table", row_label_table);
            
            jq_table.find("th").empty();
            jq_table.find("th:nth-child(1), th:nth-child(2)").remove();
            jq_table.find("td:nth-child(1), td:nth-child(2)").remove();
                
            set("table", jq_table);
 
            // also keep the sort form for that.sort()
            sort_form = jq_doc.find("form.sort-form");
            unsorted_table_url = jq_doc.find("a[rel='unsorted-table']").attr("href");

            /* each table representation links to a "base resource" that points to it. This keeps
               these in sync. Note this implies a guarantee: if seq_table "loaded" state is true, then the
               corresponding base_resource MUST:
                  1. correspond to *this* version of the seq_table
               OR 2. have "loaded" property == false */

            var base_url = jq_doc.find("a[rel='base-resource']").attr("href");
            console.log("about to call tstate('base').set_instance_url with url: " + base_url);
            tstate("base").set_instance_url(base_url);
        };

        that.seturl_error = function (xhr, status, err) {
            set("error", true);
            console.log("error: new_seq_table_instance() ajax call returned error, url = " + url);
        };


        /* seq_table.sort(): request a version of this table sorted (by the server) on sort_cols */

        that.sort = function (sort_cols) {
            if (typeof(sort_cols) === "undefined") {
                sort_cols = tstate("sort-cols").val();
            }
            
            if (sort_cols.is_empty()) {
                tstate("seq-table").set_instance_url(unsorted_table_url);
            }
            else {
                sort_form.find("input[name=sort-cols]").val(sort_cols.serialize());
                tstate("seq-table").set_instance_url(sort_form.attr("action") + "?" + sort_form.serialize());
            }
        };


        that.coldata = function (col_id) {
            var col_selector = '.' + (col_id[0] === 'c' ? col_id : "c" + col_id);

            var jq_rows = that.get("table").jquery_obj.find("tr");
            var jq_row;
            
            var col = [];
            for (var i = 0; i < jq_rows.length; i++) {
                jq_row = jq_rows.filter(".r"+(i+1));
                col[i] = jq_row.find(col_selector).text();
            }
            return col;
        };


        that.rowdata = function (row_id) {
            var row_num = '.' + (row_id[0] === 'r' ? row_id : "r" + row_id);

            var jq_tds = that.get("table").jquery_obj.find("tr." + row_num).find("td");
            
            var row = [];
            for (var i = 0; i < jq_tds.length; i++) {
                row[i] = jq_tds.filter('.c' + (i+1)).text();
            }
            return row;
        };


        that.celldata = function (row_id, col_id) {
            var row_num = row_id[0] === 'r' ? row_id : "r" + row_id;
            var col_num = col_id[0] === 'c' ? col_id : "c" + col_id;
            
            return that.get("table").jquery_obj.find("tr." + row_num).find("td." + col_num).text();
        };


        that.colname = function (col_id) {
            // Depends on ref_row. See spec for details
            return ("(" + col_id + " name here)");
        };


        that.rowname = function (row_id) {
            return ("(" + row_id + " name here)");
        };


        that.cellname = function (row_id, col_id) {
            return ("(["+ row_id + "," + col_id + "] name here)");
        };


        that.load();
        
        return that;
    };
    
    
    var new_sort_cols = function () {

        var that = {};

        var propmgr = tstate.add_property_manager(that);
        propmgr.add("cols", "serialized");

        var deserialize = function (s) {
            s = s.toString();
            if (s.length == 0) {
                that.set_to([]);
            }
            else {
                that.set_to(s.split(','));
            }
        };
        
        propmgr.setter("serialized", function (s) {
            deserialize(s);
        });
        

        that.set_to = function (cols) {
            var old_cols = that.get("cols");
            var different = false;
            
            // oh, for a native javascript map and filter...
            
            if (old_cols === null)
                different = true;
            else if (old_cols.length !== cols.length) {
                different = true;
            }
            else {
                for (var i = 0; i < cols.length; i++) {
                    if (old_cols[i] !== cols[i]) {
                        different = true;
                        break;
                    }
                }
            }
            
            if (different) {
                propmgr.set("cols", cols);
                propmgr.set("serialized", that.serialize(cols));
            }
        };


        var insert = function (cols, col, idx) {
            // uses zero based indexing
            var front = cols.slice(0, idx);
            var end = cols.slice(idx, cols.length);
            front.push(col);
            
            return front.concat(end);
        };


        var remove = function (cols, idx) {
            // uses zero based indexing
            var front = cols.slice(0, idx);
            var end = cols.slice(idx+1, cols.length);
            return front.concat(end);
        };


        that.insert = function (col, idx) {
            // uses one-based indexing, so call insert() function with idx subtracted by one            
            if ((idx > (1+that.get("cols").length)) || (idx < 1)) {
                console.log("sort_cols.insert: idx out of range");
                return;
            }
            that.set_to(insert(that.get("cols"), col, idx-1));
        };


        that.remove = function (idx) {
            // uses one-based indexing, so call remove() function with idx subtracted by one            
            if ((idx > that.get("cols").length) || (idx < 1)) {
                console.log("sort_cols.removecol: idx out of range");
                return;
            }
            that.set_to(remove(that.get("cols"), idx-1));
        };


        that.move = function (oldidx, newidx) {
            // doing this "the lazy way" (add then remove)
            // uses one-based indexing, so subtracts one from newidx, oldidx where appropriate            

            var cols = that.get("cols");
            
            if ((oldidx > cols.length) || (oldidx < 1)) {
                console.log("sort_cols.move: oldidx out of range");
                return;
            }
            if ((newidx > cols.length) || (newidx < 1)) {
                console.log("sort_cols.move: newidx out of range");
                return;
            }
            
            var moving_col = cols[oldidx-1];
            cols = remove(cols, oldidx-1);
            that.set_to(insert(cols, moving_col, newidx-1));
        };
        
        
        that.remove_all = function () {
            that.set_to([]);
        };
        
        that.serialize = function () {
            return that.get("cols").join(",");
        };
        
        that.is_empty = function () {
            return (that.get("cols").length === 0);
        }
        
        that.set_to([]);
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
            
            // temporary.
            that.get_elements = function () {
                return elements;
            };


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
                return dict_to_list(elements).sort().join(",");
            };


            var deserialize = function (s) {
                s = s.toString();               // if s has no commas, it may be construed as a number
                if (s.length == 0) {
                    that.set_to([]);
                }
                else {
                    that.set_to(s.split(','));
                }
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
        propmgr.add("selected", "base", "seq-table", "sort-cols");
        var set = propmgr.set;

        global_pm = propmgr;
        global_new_base = new_base_instance;
        
        set("selected", new_selected_elements());
        set("base", new_url_backed_container(new_base_instance));
        set("seq-table", new_url_backed_container(new_seq_table_instance));
        set("sort-cols", new_sort_cols());
        
        tstate.root(root);                          // now tstate("tree") = tree as defined above, etc.
    };


    return that;
}());


$(document).ready(function() {

    var size = function () {
        /* hacky - box model sets #row-label-panel's scrolling-content panel to *max* of children's
           width. But they're floated next to each other, so "true" width should be their *sum* */

        var content = $("#row-label-panel .scrolling-content");
        var tree_width = $("#tree").width() 
        var labels_width = $("#row-labels-table").width();
        
        content.width(tree_width + labels_width);
        safely_size_overflow_containers();
    };
    
    appstate.init();
    
    tstate("seq-table.instance.table").on_change(function (table) {
        
        if (table && tstate("seq-table.instance.loaded").val()) {  
            $("#loading-panel").hide();
            $("#seq-table-container").append(table);
            
            /* make the selected rows and columns visible */
            var scols = tstate("selected.cols").as_list();
            $(".c" + scols.join(",.c")).addClass("selected");
            
            var srows = tstate("selected.rows").as_list();
            $(".r" + srows.join(",.r")).addClass("selected");
            
            if (tstate("seq-table.instance.row-label-table").val()) {
                size();
            }
        }
    });
    
    tstate("seq-table.instance.row-label-table").on_change(function (row_label_table) {
        
        if (row_label_table && tstate("seq-table.instance.loaded").val()) {      
            $("#row-labels").append(row_label_table);
            
            var srows = tstate("selected.rows").as_list();
            $(".r" + srows.join(",.r")).addClass("selected");
            
            if (tstate("seq-table.instance.table").val()) {
                size();
            }
        }
    });
    
    tstate("seq-table.instance.loaded").on_change(function (loaded) {
        if (!loaded) {
            $("#loading-panel").show();
            $(".seq-table").remove();
            $("#row-labels-table").remove();
        }
    });

    
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
    
    
    /*** column hovering and clicking ***/
    
    
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
    

    /*** row hovering and clicking ***/
    

    $("#row-labels-table").live("mouseover", function (e) {
        var tr = $(e.target).closest("tr");
        var row_class_selector = "."+tr.attr("className").match(/\b(r\d+)\b/)[1];
        var row = $(row_class_selector);

        tr.find("td").addClass("hovered-row");
        row.addClass("hovered-row");

        tr.bind("mouseout.noraseq-hover", function () {
            tr.find("td").removeClass("hovered-row");
            row.removeClass("hovered-row");
            tr.unbind("mouseout.noraseq-hover");
        });
    });

    $("#row-labels-table").live("click", function (e) {
        var row_class = $(e.target).closest("tr").attr("className").match(/\b(r\d+)\b/)[1];
        var row_num = row_class.substring(1,row_class.length)*1;
        
        if ($("."+row_class).hasClass("selected")) {
            tstate("selected.rows").remove([row_num]);
        }
        else {
            tstate("selected.rows").add([row_num]);
        }
    });
    
    
    tstate("selected.rows.added").on_change(function (added) {
        var n_added = added.length;
        for (var i = 0; i < n_added; i++) {
            $(".r" + added[i]).addClass("selected");
        }
    });
    
    tstate("selected.rows.removed").on_change(function (removed) {
        var n_removed = removed.length;
        for (var i = 0; i < n_removed; i++) {
            $(".r" + removed[i]).removeClass("selected");
        }
    });
    

    /*** history and the back button ***/

    tstate("selected.cols.serialized").hist("scol");
    tstate("selected.rows.serialized").hist("srow");
    tstate("sort-cols.serialized").hist("sort");


    /*  workaround the "forward-back-forward problem" by setting the document fragment.

        The problem:
        
                  starting at  /alignment/1/viewer             
        (select column 1) -->  /alignment/1/viewer/#scol=1
        (hit back button) -->  /alignment/1/viewer/#

        Now the forward button is greyed out, since the browser thinks '/alignment/1/viewer/#' is a 'new' url
        
        The solution: set href to '#' before doing anything else.
    */
    
    if (window.location.hash.length === 0) {
        window.location.href = '#';
    }
    
    // and finally load the alignment
    tstate("base").set_instance_url(BASE_URL);
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

