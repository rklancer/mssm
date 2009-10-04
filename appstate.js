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

    /* make_url_backed(obj, args):

       Add "loaded", "error", "urL" properties to object; try to load it from args.url; handle retry logic
       (and redirection logic?) as necessary. Callback to args.success() when we have data; callback
       args.error() when we decide to give up retrying. Also endow obj with cancel_loading() method */

    var make_url_backed = function (obj, args) {

        args = args || {};

        var propmgr = args.property_manager;
        propmgr.add("url", "loaded", "error");
        var get = propmgr.get;
        var set = propmgr.set;
        var url = args.url || null;
        var seturl_success = args.seturl_success;
        var seturl_error = args.seturl_error || function () {};
        var xhr;

        set("loaded", false);
        set("error", false);
        set("url", args.url);

        if (url) {
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

            xhr = $.ajax({
                url: url,
                success: handle_success,
                error: handle_error,
                dataType: args.data_type
            });
        }

        obj.cancel_loading = function () {
            if (xhr) {
                xhr.abort();
            }
        };
    };


    var new_url_backed_container = function (instance_constructor) {

        var that = {};

        var propmgr = tstate.make_property_container(that);
        var set = propmgr.set;

        propmgr.add("instance");

        that.seturl = function (url) {
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
        set("threshold", null);

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


    // groups_def now lives under seq_table.instance; this means it goes away if seq-table does
    // (which is what you want).

    var new_groups_def = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;
        propmgr.add("source-type", "groups");

        var jq_request_form;

        var new_grouping = function (url) {

            var that = {};
            var propmgr = tstate.make_property_container(that);

            make_url_backed(that, {
                url: url,
                property_manager: propmgr,
                seturl_success: function (response) {
                    // set the grouping to whatever the server says
                },

                seturl_error: function () {
                    // ...
                }
            });

            // initialize an empty grouping grouping here.

            return that;
        };


        var set_grouping_from_threshold = function () {
            var threshold = tstate("tree.threshold").val();

            if (threshold && jq_request_form) {
                jq_request_form.find("input[name='threshold-value']").val(threshold);
                set("grouping",
                    new_grouping( jq_request_form.attr("action") + "?" + jq_request_form.serialize() )
                );
            }
            else {
                set("grouping", new_grouping(null));
            }
        };


        that.set_source = function (args) {
            if (args.type === "threshold") {
                set("source_type", "threshold");
                jq_request_form = args.form;
                set_grouping_from_threshold();
            }
            else if (args.type === "url") {
                set("source_type", "url");
                set("grouping", new_grouping(args.url));
            }
        };


        tstate("tree.instance.threshold").on_change( function () {
            if (that.get("source_type") === "threshold") {
                set_grouping_from_threshold();
            }
        });

        return that;
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

        propmgr.add("table", "groups-def");
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



    var new_selected_elements = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;
        propmgr.add("rows", "cells", "cols");


        var new_element_set = function () {

            var that = {};
            var propmgr = tstate.make_property_container(that);
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


            // uses a pretty trivial serialization-deserialization protocol
            var serialize = function () {
                return dict_to_list(elements).splice(",");
            };


            var deserialize = function (s) {
                set_to(s.split(","));
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


        return that;
    };


    that.init = function () {

        var root = {};

        var propmgr = tstate.add_property_capability(root);
        propmgr.add("tree"/* ... */);
        var set = propmgr.set;

        set("tree", new_url_backed_container(new_tree));
        set("base" /* ... */);                      // or some similar name.
        set("selected", new_selected_elements());

        tstate.root(root);                          // now tstate("tree") = tree as defined above, etc.
    };
}());


// Example.

$(document).ready(function () {

    appstate.init();

    // i.e., history mechanism whould write selected.rows.serialized like "srows=r12,r13,r14"; should
    // observe changed to srows in location.hash and write them back to selected.rows.serialized

    tstate("selected.rows.serialized").hist("srows");
    tstate("selected.cols.serialized").hist("scols");
    tstate("selected.cells.serialized").hist("scells");

    // other things will need to happen too, but this is one.

    tstate("selected.rows.added").on_change( function () {
        // idea is to use apply() to make this === tstate("selected.rows.added") in this context.
        $(this.as_list().splice(" .")).addClass("selected");
    });

    // etc.
});
