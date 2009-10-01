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

    var new_ajax_loader = function (args) {

        var data_type = args.data_type || {};
        var success_callback = args.success;
        var error_callback = args.error;
        var is_loaded = args.is_loaded;
        var set_loaded = args.set_loaded;
        var cur_url = args.cur_url;

        var that = {};

        /* "url" property represents the url of the most recent (and thus only valid) request;
           cur_xhr is the xhr object of the *currently outstanding* request, if any; null otherwise */

        var cur_xhr = null;

        /* handle_success: passed to $.ajax as the success handler. Sets loader and client-object state &
           calls client success_callback -- UNLESS the request that led to this callback has been superseded
           by cur_request */

        var handle_success = function (this_request_url, response, status) {
            if (this_request_url === cur_url()) {
                cur_xhr = null;
                set_loaded(true);           // should this be set before or after success_callback?
                success_callback(response, status);
            }
        };

        /* handle_error: passed to $.ajax as the error handler; (eventually) will handle retry logic;
           calls client error_callback if it can't figure out what to do (and UNLESS, as above, the request
           that led to this callback has been superseded by cur_request anyway) */

        var handle_error = function (this_request_xhr, status, err) {
            if (this_request_xhr === cur_xhr) {
                cur_xhr = null;
                error_callback(this_request_xhr, status, err);
            }
        };

        /* do_xhr: Use jquery's $.ajax to initiate the request; sets loader and client-object state */

        var do_xhr = function (url) {
            set_loaded(false);
            return $.ajax({
                url: url,
                /* Create a new callback closure to remember what url this callback is for -- this should
                   prevent us from responding to superseded requests. (I don't yet trust xhr.abort() to
                   always prevent the callback from being called -- what if it's already on a queue when
                   abort is called?) */
                success: function (response, status) {
                    handle_success(url, response, status);
                },
                // no need for closure -- error handler can just check xhr object that $.ajax() passes in
                error: handle_error,
                dataType: data_type
            });
        };

        /* ajax_loader.load(url): Initiate ajax request to set client object's backing url, unless the object
           is already backed by that url or we have issued a still-outstanding request for that url.

           If request url is null, terminate requests and set url to null */

        that.load = function (url) {

            url = url || null;                      // normalize falsy values to "null"
            var url_change = (url !== cur_url());

            if (url_change) {

                // abort any outstanding requests & issue a new one (unless requested url is "null")
                if (cur_xhr) {
                    cur_xhr.abort();
                }
                cur_xhr = url ? do_xhr(url) : null;
            }
            else if (url && !is_loaded() && !cur_xhr) {

                // even though desired url hasn't changed, object isn't loaded & there isn't an active request
                cur_xhr = do_xhr(url);
            }

            return url_change;
        };


        return that;
    };


    /* add_url_backed_capability:

       Endow client object obj with an ajax_loader object, "url" and "loaded" properties, and seturl method. A
       Call to seturl sets "url" parameter, invoked ajax_loader's load(url) method, and sets "loaded" property
       appropriately.

       Guarantees: "url" property refers to most recent request. The data are available iff "loaded" is true.
    */

    var add_url_backed_capability = function (obj, args) {

        var on_url_change = args.on_url_change || function () {};
        var propmgr = args.property_manager;
        propmgr.add("url", "loaded");

        var loader = new_ajax_loader({
            data_type: args.data_type,
            success: args.seturl_success,
            error: args.seturl_error,
            set_loaded: function (s) { propmgr.set("loaded", s); },
            is_loaded: function () { obj.get("loaded"); },
            cur_url: function () { obj.get("url"); }
        });

        propmgr.set("url", null);           // initial value; no listeners yet!

        obj.seturl = function (url) {
            if (loader.load(url)) {
                on_url_change(url);
                propmgr.set("url", url);
            }
        };

        propmgr.setter("url", obj.seturl);
    };


    var new_base_resource = function () {

        // Representation of the single point for updating alignment info, requesting sorted versions
        // Like a "main menu". Linked from the resources that actually contain alignment data.

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        propmgr.add("error");

        add_url_backed_capability(that, {
            property_manager: propmgr,
            seturl_success: function (html, status) {
                var jq_base = $(html);

                tstate("tree.url").set( jq_base.find("a[rel='tree']").attr("href") );
                tstate("seq-table.url").set( jq_base.find("a[rel='seq-table']").attr("href") );

                /* If the server provides a *link* to a groups_def, that means it has determined the grouping
                   to use, and we should pass the url to the groups_def object. If the server provides a
                   *form* (with class "form.groups-def-request"), the server is providing a facility for
                   requesting a groups_def based on some parameter(s) (specified by an additional class)-- so
                   pass the form along to the groups_def object.*/

                var grplink = jq_base.find("a[rel='groups-def']");
                if (grplink) {
                    tstate("groups_def").set_source({
                        type: "url",
                        url: grplink.attr("href")
                    });
                }
                else {
                    // note the use of 2 classes: groups-def-request AND the refinement "threshold-request"
                    tstate("groups-def").set_source({
                        type: "threshold",
                        form: jq_base.find("form.groups-def-request.threshold-request")
                    });
                }
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);          // let the ui know to do something
                console.log("Error");        // and log it.
            }
        });

        return that;
    };


    var new_tree = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        propmgr.add("error", "data");
        propmgr.settable("threshold");

        add_url_backed_capability(that, {
            property_manager: propmgr,
            data_type: "json",
            seturl_success: function (json_obj, status) {
                set("data", json_obj);
            },

            on_url_change: function () {
                set("threshold", null);
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);
                console.log("error: new_tree.seturl ajax call returned error.");
            }
        });


        return that;
    };


    var new_groups_def = function () {

        var that = {};

        var jq_request_form;
        var seq_table_url;

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;
        propmgr.add("source-type", "error");


        add_url_backed_capability(that, {
            property_manager: propmgr,
            seturl_success: function (response) {
                // set the groups-def to whatever the server says
            },

            seturl_error: function () {
                // ...
            }
        });


        var clear = function () {
            that.seturl(null);
            // set the groups-def to null...
        };


        var set_from_threshold = function () {
            if (that.get("source_type") === "threshold") {
                var t = tstate("tree.threshold").val();
                if (t) {
                    jq_request_form.find("input[name='threshold-value']").val(t);
                    that.seturl(jq_request_form.attr("action") + "?" + jq_request_form.serialize());
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
                that.seturl(args.url);
            }
        };


        tstate("tree.threshold").on_change( function () {
            set_from_threshold();
        });


        tstate("seq-table.url").on_change( function (url) {
            if (url !== seq_table_url) {
                clear();
            }
        });


        return that;
    };


    var new_seq_table = function () {

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

        propmgr.add("error", "table");

        var sort_form;

        add_url_backed_capability(that, {
            property_manager: propmgr,
            seturl_success: function (response, status) {

                var jq_doc = $(response);
                var jq_table = jq_doc.find("table#seq-table");

                set("table", {
                    html: jq_table.html(),
                    jquery_obj: jq_table
                });

                // also keep the sort form
                sort_form = jq_doc.find("form.sort-form");

                /* each table representation links to a "base resource" that points to it. This keeps
                   these in sync. Note this implies a guarantee: if seq_table "loaded" state is true, then the
                   corresponding base_resource MUST:
                      1. correspond to *this* version of the seq_table
                   OR 2. have "loaded" property == false */

                tstate("base.url").set( jq_doc.find("a[rel='base-resource]").attr("href") );
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);
                console.log("error: new_tree.seturl ajax call returned error.");
            }
        });


        /* seq_table.sort(): request a version of this table sorted (by the server) on sort_cols */

        that.sort = function (sort_cols) {
            sort_form.find("input[name=sort-cols]").val(sort_cols.serialize());
            that.seturl( sort_form.attr("action") + "?" + sort_form.serialize() );
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


    var new_sort_cols = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;
        propmgr.add("cols");
        set("cols", []);


        var add = function (cols, col, idx) {
            var newcols = cols.slice(0, idx);
            newcols.push(col);
            newcols.concat(cols.slice(idx, cols.length));

            return newcols;
        };


        var remove = function (cols, idx) {
            var newcols = cols.slice(0, idx);
            newcols.concat(cols.slice(idx+1, cols.length));

            return newcols;
        };


        that.add = function (col, idx) {
            if (idx > that.get("cols").length) {
                console.log("sort_cols.addcol: idx > array.length");
                return;
            }
            set("cols", add(that.get("cols"), col, idx));
        };


        that.remove = function (idx) {
            if (idx >= that.get("cols").length) {
                console.log("sort_cols.removecol: idx >= array.length");
                return;
            }
            set("cols", remove(that.get("cols"), idx));
        };


        that.move = function (oldidx, newidx) {
            // doing this "the lazy way" (add then remove) shouldn't affect performance in any meaningful way

            var cols = that.get("cols");
            var col = cols[oldidx];

            cols = remove(cols, oldidx);
            if (oldidx < newidx) {
                // account for shift of indexes caused by removing
                cols = add(cols, col, newidx-1);
            }
            else {
                cols = add(cols, col, newidx);
            }

            set("cols", cols);
        };


        that.remove_all = function () {
            set("cols", []);
        };


        that.serialized = function () {
            return that.get("cols").join(",");
        };


        return that;
    };


    var new_just_columns_tab = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        propmgr.add("score-option", "name");
        propmgr.settable("score-option");

        set("name", "just-columns");

        return that;
    };


    var new_selected_elements = function () {

        var that = {};

        var propmgr = tstate.add_property_capability(that);
        var set = propmgr.set;

        var elt_types = ["rows", "cols", "cells"];
        propmgr.add(elt_types);

        var new_element_set = function (list) {
            var that = {};

            var elements = {};

            var possibly_split = function (poss_str) {
                if (typeof poss_str === "string") {
                    poss_str = poss_str.split(',');
                }
                return poss_str;
            };


            that.add = function (new_elts) {
                new_elts = possibly_split(new_elts);

                for (var i = 0; i < new_elts.length; i++) {
                    elements[new_elts[i]] = true;
                }
            };

            that.remove = function (old_elts) {
                old_elts = possibly_split(old_elts);

                for (var i = 0; i < old_elts.length; i++) {
                    delete elements[old_elts[i]];
                }
            };

            that.serialize = function () {
                var vals = [];
                for (var item in elements) {
                    if (elements.hasOwnProperty(item)) {
                        vals.push(item);
                    }
                }
                return vals.splice(",");
            };

            that.add(list);

            return that;
        };


        var setter_for = function (pname) {
            return function (list) {
                set(pname, new_element_set(list))   ;
            };
        };

        for (var i = 0; i < elt_types.length; i++) {
            propmgr.setter(elt_types[i], setter_for(elt_types[i]));
        }


        that.serialize = function () {
            var vals = [];
            for (var i = 0; i < elt_types.length; i++) {
                vals.push(elt_types[i] + ":" + that.get(elt_types[i]).serialize());
            }
            return vals.splice(";");
        };


        that.deserialize = function (s) {
            var rows = s.match("rows:([,r0-9]*)")[1];
            set("rows", new_element_set(rows));

            var cols = s.match("cols:([,c0-9]*)")[1];
            set("cols", new_element_set(cols));

            var cells = s.match("cells:([,rc0-9]*)")[1];
            set("cells", new_element_set(cells));
        };


        return that;
    };


    return {
        // either setup app object here, or use "that" convention and replace this with "return that;"
    };
}());


/*
    What else needs to be remembered:

    selected elements (set, add, remove, add all between 2 rows or all between 2 columns?
    hovered elements (this is "set-only", with no add or remove semantics)
    selected tab

    just-columns option that is selected.

    just_columns_tab
        "score-option"

    hovered_elements is another "just a property"

    selected_elements
        set
        add
        remove
        (need seq_table method to get all cols between x and y)

    selected tab => some way to register "just a property" at the base of the hierarchy

    tstate("selected.rows").add(<list>);
    tstate("selected.rows").set(<list>);


    tstate("hovered").set({type: row, <list>});

    does this mean "set the root property "hovered to this object"? (Sure, why not?)

*/

/* base resource works like this:

    /alignment/1/ -> contains list of links and forms

        <dl>
            <dd> base resource </dd> : <dt><a rel="baseresource" href="alignment/1/"></dt>
            <dd> tree </dd> : <dt><a rel="tree" href="alignment/1/tree"</dt>
            <dd> comments </dd> : <dt><a rel="comments" href="/alignment/1/comments/"</dt>
            <dd> alignment contents </dd> : <dt><a rel= "alignment-table" href="/alignment/1/table"></dt>
            etc.
        </dl>

        <!-- semantically identify form type with class attribute. Note that we *could* go crazy adding
             indirection. E.g., we could define a URI for GETing a column URI from a form, and then we
             could POST comments from the page at the column URI. I think this would be silly. Just
             form-encode the comment and the column/cell/row identifier -->

        <form class="commentform" action=/alignment/1/comments" method="POST">...</form>
        <!-- redirect to comment resource, which includes 1. link to whole mapping 2. new hash-->
        etc.

    /alignment/1/table should contain

        1. a link to /alignment/1/
        2. a form for requesting a sorted alignment (semantically identified with class, as above)
        3. the table containing the function alignment
        4. a link to the grouping definition

    so after sorting you would have

        a *base resource* at /alignment/1/sorted/c17

    NOTE a sort request to the alignment *table* resource /alignment/1/table?sortBy=c17 would redirect to
    /aligment/1/sorted/c17/table . This latter representation would contain a link to the base resource,
    /alignment/1/sorted/c17/

    This way, when the frontend wants to sort an alignment, it just needs to perform one request to get
    and display the sorted table; it could then send a second request to get the new representation at the
    base URL (i.e., /alignment/1/sorted/c17/, which contains a reference to /alignment/1/sorted/c17/table)
    What gets stored in the browser history is URL of the base resource for the sorted alignment.
    This base resource will point to all the subsidiary resources the app needs to go and get in order to
    display the sorted alignment correctly.

*/

/*

    base_resource
        url
        loaded
        seturl()

    tree
        data
        loaded
        url

        seturl()

    seqtable
        loaded
        html

        coldata()
        rowdata()
        celldata()

        colname()
        rowname()
        cellname()

    groupsdef

        source: tree, sortcols, sortid

        set_threshold_service(url, param)
        set_from_threshold(t)
        set_from_server(url)

        OK: if source == tree, then groupsdef needs to told a function from threshold to grouping

            if source == sortcols, groupsdef needs to be told a url

            if source == sortid, groupsdef needs to be told a url

    refcols
        cols

    refrow

    opts
        property_highlight

*/


