/* appstate.js - application state objects-for handling complex display logic */


var appstate = (function () {

    /* new_ajax_loader:

        Each display object keeps an ajax_loader object to handle requesting that display object's data from a
        corresponding server-side url. The ajax_loader handles the details of:

        * ignoring requests if the url being requested is the same one already backing the display object
        * canceling requests if the display object requests a different backing url before the first one has
          been processed
        * (eventually) of retrying timed-out requests and distinguishing "retriable" requests from
          permanently-erroneous requests for which it must call the supplied error callback (e.g., in the case
          of a 404 response)
    */

    var that = {};
    
    // make_url_backed(obj, args):
    //
    // add "loaded", "error", "urL" properties to object; try to load it from args.url; handle retry logic
    // (and redirection logic?) as necessary. Callback to args.success() when we have data; callback
    // args.error() when we decide to give up retrying. Also endow obj with cancel_loading() method

    var make_url_backed = function (obj, args) {
    
        var propmgr = args.property_manager;
        propmgr.add("url", "loaded", "error");
        var set = propmgr.set;
        var seturl_success = args.seturl_success;
        var seturl_error = args.seturl_error;
        
        set("loaded", false);
        set("error", false);
        set("url", args.url);
                
        var handle_success = function (response, status) {
            // implement redirection logic here if needed
            set("loaded", true);
            seturl_success(response, status);
        };
        
        var handle_error = function (xhr, status, err) {
            // implement retry logic here
            
            if (!get("loaded")) {
                set("error", true);
                seturl_error(xhr, status, err);
            }
        };

        var xhr = $.ajax({
            url: url,
            success: handle_success,
            error: handle_error,
            dataType: args.data_type
        }); 
        
        obj.cancel_loading = function () {
            xhr.abort();
        };
    };


    var new_url_backed_container = function (instance_constructor) {

        var that = {};

        var propmgr = tstate.make_property_container(that);
        var set = propmgr.set;

        propmgr.add("instance");
        
        that.seturl = function (url) {
            url = url || null;
            
            if (url !== get("instance.url")) {
                var instance = get("instance");
                if (instance) {
                    instance.cancel_loading();
                }
                set("instance", instance_constructor(url));
            }
        };
    
        return that;
    };


    var new_base_resource = function (url) {

        // Representation of the single point for updating alignment info, requesting sorted versions
        // Like a "main menu". Linked from the resources that actually contain alignment data.

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        make_url_backed(that, {
            url : url,
            property_manager: propmgr,
            seturl_success: function (html, status) {
                var jq_base = $(html);

                tstate("tree").seturl( jq_base.find("a[rel='tree']").attr("href") );
                
                tstate("seq-table").seturl( jq_base.find("a[rel='seq-table']").attr("href") );

                /* If the server provides a *link* to a groups_def, that means it has determined the grouping
                   to use, and we should pass the url to the groups_def object. If the server provides a
                   *form* (with class "form.groups-def-request"), the server is providing a facility for
                   requesting a groups_def based on some parameter(s) (specified by an additional class)-- so
                   pass the form along to the groups_def object.*/
                
                var grplink = jq_base.find("a[rel='groups-def']");
                if (grplink) {
                    tstate("seq-table.instance.groups-def").set_source({
                        type: "url",
                        url: grplink.attr("href")
                    });
                }
                else {
                    // note the use of 2 classes: groups-def-request AND the refinement "threshold-request"
                    tstate("seq-table.instance.groups-def").set_source({
                        type: "threshold",
                        form: jq_base.find("form.groups-def-request.threshold-request")
                    });
                }
            },

            seturl_error: function (xhr, status, err) {
                console.log("Error loading base_resource" + url);        // and log it.
            }
        });

        return that;
    };


    var new_tree = function (url) {
        
        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        propmgr.add("data", "threshold");
        
        make_url_backed(that, {
            url: url,
            property_manager: propmgr,
            data_type: "json",
            sucess: function (json_obj, status) {
                set("data", json_obj);
            },

            seturl_error: function (xhr, status, err) {
                console.log("error: new_tree.seturl ajax call returned error.");
            }
        });
    };
    
    
    var new_seq_table = function (url) {

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

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        propmgr.add("table" "groups-def");
        set("groups-def", new_groups_def());
        
        var sort_form;

        make_url_backed(that, {
            url: url,
            property_manager: propmgr,
            seturl_success: function (response, status) {
                var jq_doc = $(response);
                var jq_table = jq_doc.find("table#seq-table");

                set("table", {
                    html: jq_table.html(),
                    jquery_obj: jq_table
                });
                
                // also keep the sort form for that.sort()
                sort_form = jq_doc.find("form.sort-form");

                /* each table representation links to a "base resource" that points to it. This keeps
                   these in sync. Note this implies a guarantee: if seq_table "loaded" state is true, then the
                   corresponding base_resource MUST:
                      1. correspond to *this* version of the seq_table
                   OR 2. have "loaded" property == false */

                tstate("base").seturl( jq_doc.find("a[rel='base-resource]").attr("href") );
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);
                console.log("error: new_tree.seturl ajax call returned error.");
            }
        });
        
        /* seq_table.sort(): request a version of this table sorted (by the server) on sort_cols */

        that.sort = function (sort_cols) {
            sort_form.find("input[name=sort-cols]").val(sort_cols.serialize());
            tstate("tree").seturl( sort_form.attr("action") + "?" + sort_form.serialize() );
        };

        that.coldata = function (col_id) {

            var selector = col_id[0] === 'c' ? col_id : "c" + col_id;
            selector = "." + selector + ".r";

            var jq_rows = that.get("table").jquery_obj.find("tr");

            var col = [];
            for (var i = 0; i < jq_rows.length; i++) {
                col[i] = jq_rows.find(selector + (i+1)).text();
            }

            return col;
        };

        that.rowdata = function (row_id) {

            var row_selector = row_id[0] === 'r' ? row_id : "r" + row_id;
            var selector = "." + row_selector + ".c";

            var jq_tds = that.get("table").jquery_obj.find("td." + row_selector);

            var row = [];
            for (var i = 0; i < jq_tds.length; i++) {
                row[i] = jq_tds.filter(selector + (i+1)).text();
            }

            return row;
        };

        that.celldata = function (row_id, col_id) {
            var row_selector = row_id[0] === 'r' ? row_id : "r" + row_id;
            var col_selector = col_id[0] === 'c' ? col_id : "c" + col_id;

            return that.get("table").find("." + row_selector + "." + col_selector).text();
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

        return that;
    };


    // groups_def now is lives under seq_table.instance; this means it goes away if seq-table does
    // (which is what you want). However, source


    var new_groups_def = function () {

        var that = {};

        var jq_request_form;
        var seq_table_url;

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;
        propmgr.add("source-type", "groups");


        var new_grouping = function (url) {
            
            // add properties
            
            add_url_backed_capability(that, {
                property_manager: propmgr,
                seturl_success: function (response) {
                    // set the groups-def to whatever the server says
                },

                seturl_error: function () {
                    // ...
                }
            });
            
        };


        var clear = function () {
            that.seturl(null);
            // set the groups-def to null...
        };


        var set_from_threshold = function () {
            if (that.get("source_type") === "threshold") {
                var t = tstate("tree.threshold").val();
                if (t) {
                    jq_request_form.find("input[name='threshold-value']").val(t);
                    set("grouping", 
                        new_grouping( jq_request_form.attr("action") + "?" + jq_request_form.serialize()
                    );
                }
                else {
                    clear();
                }
            }
        };


        that.set_source = function (args) {
            seq_table_url = tstate("seq-table.url").val();

            if (args.type === "threshold") {
                set("source_type", "threshold");
                jq_request_form = args.form;
                set_from_threshold();
            }
            else if (args.type === "url") {
                set("source_type", "url");
                set("grouping", new_grouping(url));
            }
        };


        tstate("tree.instance.threshold").on_change( function () {
            set_from_threshold();
        });


        return that;
    };



    that.init = function () {
    
        var root = {};
    
        var propmgr = tstate.add_property_capability(root);
        propmgr.add("tree",...);
        var set = propmgr.set;
    
        set("tree", new_url_backed_container(new_tree));
        set("base", ...);           // or some similar name.
    
        tstate.root(root);                          // now tstate("tree") = tree as defined above, etc.
    };
}());


$(document).ready(function () {

    appstate.init();
    

    
    tstate("selected.rows.serialized").hist("sel");
    
    // other things will need to happen too, but this is one.
    
    tstate("selected.rows.added").on_change( function () {
        // idea is to use apply() to make this === tstate("selected.rows.added") in this context.
        $(this.as_list().splice(" .")).addClass("selected")     
    });
    
    
});
