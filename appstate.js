/* appstate.js - application state objects-for handling complex display logic */


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
        dosort()

    refrow

    opts
        property_highlight

*/


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

    var new_ajax_loader = function (opts) {
        var success_callback = opts.success;
        var error_callback = opts.error;
        var set_loaded = opts.set_loaded;
        var is_loaded = opts.is_loaded;
        var cur_url = opts.cur_url;
        var set_cur_url = opts.set_cur_url;

        var that = {};

        /* cur_request.url represents the url of the *most recent* ajax request by the client object
           cur_request.xhr is the xhr object of the *currently outstanding* request, if any; null otherwise */

        var cur_request = {url: "", xhr: null};

        /* handle_success: passed to $.ajax as the success handler. Sets loader and client-object state &
           calls client success_callback -- UNLESS the request that led to this callback has been superseded
           by cur_request */

        var handle_success = function (this_request_url, response, status) {
            // ignore the callback if it's for an obsolete request
            if (this_request_url === cur_request.url) {
                cur_request.xhr = null;
                set_cur_url(this_request_url);
                set_loaded(true);           // should this be set before or after success_callback?
                success_callback(response, status);
            }
        };

        /* handle_error: passed to $.ajax as the error handler; (eventually) will handle retry logic;
           calls client error_callback if it can't figure out what to do (and UNLESS, as above, the request
           that led to this callback has been superseded by cur_request anyway) */

        var handle_error = function (this_request_xhr, status, err) {
            // ignore the callback if it's for an obsolete request
            if (this_request_xhr === cur_request.xhr) {
                cur_request.xhr = null;     // keep cur_request for reload
                error_callback(this_request_xhr, status, err);
            }
        };

        /* doxhr: Use jquery's $.ajax to initiate the request; sets loader and client-object state */

        var doxhr = function(url) {
            set_loaded(false);
            cur_request.url = url;
            cur_request.xhr = $.ajax({
                url: url,
                /* Create a new callback closure to remember what url this callback is for -- this should
                   prevent us from responding to superseded requests. (I don't yet trust xhr.abort() to
                   always prevent the callback from being called -- what if it's already on a queue when
                   abort is called?) */
                success: function (response, status) {
                        handle_success(url, response, status);
                    },
                error: handle_error
            });
        };

        /* ajax_loader.load(url): Initiate ajax request to set client object's backing url, unless the object
           is already backed by that url or we have issued a still-outstanding request for that url */

        that.load = function (url) {
            if (is_loaded()) {
                if (url !== cur_url()) {
                    // object is loaded from some url, but request is for a different url
                    doxhr(url);
                }
            }
            else if (!cur_request.xhr) {
                // object is not loaded, and there is no outstanding request
                doxhr(url);
            }
            else if (url !== cur_request.url) {
                // object is not loaded, there is an outstanding request, but it's for a different url
                cur_request.xhr.abort();
                doxhr(url);
            }
            /* ignore the two remaining cases:
                1. object is loaded, but request was to load the same url
                2. object is not loaded, and there is an outstanding request, but it's for the same url anyway
            */
        };

        return that;
    };


    var add_url_backed_capability(obj, secrets) {

        var set = secrets.set;
        var get = obj.get;
        var add_properties = secrets.add_properties;

        add_properties("url", "loaded");

        loader = new_ajax_loader({
            success: secrets.seturl_success,
            error: secrets.seturl_error,
            set_loaded: function (s) { set("loaded", s); },
            is_loaded: function () { get("loaded"); },
            cur_url: function () { get("url"); },
            set_cur_url: function (url) { set("url", url); }
        });

        obj.seturl = function (url) {
            loader.load(url);
        };
    }


    var new_base_resource = function (app) {

        // Representation of the single point for updating alignment info, requesting sorted versions
        // Like a "main menu". Linked from the resources that actually contain alignment data.

        ./* base resource works like this:

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

        var that = {};
        var secrets = {};

        tst.add_property_capability(that, secrets);
        var set = secrets.set;
        var add_properties = secrets.add_properties;

        add_properties("error");

        add_url_backed_capability(that, {
            set: set,

            add_properties: add_properties,

            seturl_success: function (html, status) {
                var base = $(html);

                app.tree.seturl( $("a[rel='tree']", base).attr("href") );
                app.seqtable.seturl( $("a[rel='seqtable']", base).attr("href") );

                /* If the server provides a *link* to a groupsdef, that means it has determined the grouping
                   to use, and we should pass the url to the groupsdef object. If the server provides a *form*
                   (with class "groupsdef-req"), the server is providing a facility for requesting a groupsdef
                   based on some parameter(s) -- so pass the form along to the groupsdef object. */

                var grplink = $("a[rel='groupsdef']", base);
                if (grplink) {
                    app.groupsdef.seturl( grplink.attr("href") );
                }
                else {
                    app.groupsdef.setreqform( base.find("form.groupsdef-req") );
                }
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);          // let the ui know to do something
                console.log("Error")            // and log it.
            }
        });

        return that;
    };


    var new_tree = function (app) {

        var that = {};
        var secrets = {};

        tst.add_property_capability(that, secrets);

        var set = secrets.set;
        var add_properties = secrets.add_properties;

        add_properties("error", "data");

        add_url_backed_capability(that, {
            set: set,

            add_properties: add_properties,

            seturl_success: function (response, status) {
                // remember we expect json
                set("data", response);
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);
                console.log("error: new_tree.seturl ajax call returned error.")
            }
        });

        return that;
    };


    var new_seqtable = function () {

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
        var secrets = {};

        tst.add_property_capability(that, secrets);

        var set = secrets.set;
        var add_properties = secrets.add_properties;

        add_properties("error", "html");

        add_url_backed_capability(that, {
            set: set,

            add_properties: add_properties,

            seturl_success: function (response, status) {
                set("html", response);
            },

            seturl_error: function (xhr, status, err) {
                set("error", true);
                console.log("error: new_tree.seturl ajax call returned error.")
            }
        });

        that.coldata = function (colnum) {
            ;
        };

        that.rowdata = function (rownum) {
            ;
        };

        that.celldata = {
            ;
        };

        return that;
    }


    var new_sort_cols = function () {
        var that = {};
        var set = tst.propertize(that, ["cols"]);

        set("cols", []);

        var add = function (cols, col, idx) {
            var newcols = cols.slice(0, idx);
            newcols.push(col);
            newcols.concat(cols.slice(idx, cols.length));

            return newcols;
        }

        var remove = function (cols, idx) {
            var newcols = cols.slice(0,idx);
            newcols.concat(cols.slice(idx+1, cols.length));

            return newcols;
        }

        that.add = function (col, idx) {
            if (idx > array.length) {
                console.log("sort_cols.addcol: idx > array.length");
                return;
            }
            set("cols", add(that.get("cols"), col, idx));
        }

        that.remove = function (idx) {
            if (idx >= array.length) {
                console.log("sort_cols.removecol: idx >= array.length");
                return;
            }
            set("cols", remove(that.get("cols"), idx));
        }

        that.move = function (oldidx, newidx) {
            // doing this "the lazy way" (add then remove) shouldn't affect performance in any meaningful way

            var cols = that.get("cols");
            var col = cols[oldidx];

            cols = remove(cols, oldidx);
            if (oldidx < newidx) {
                //account for shift of indexes caused by removing
                cols = add(cols, col, newidx-1);
            }
            else {
                cols = add(cols, col, newidx);
            }

            set("cols", cols);
        }

        that.removeall = function () {
            set("cols", []);
        }

        that.aslist = function () {
            // return a list suitable for use in form-encoded GET to server
        }

        return that;
    }

    var new_ref_row = function () {

    }


    var new_groups_def = function () {
    }

    return {
        // either setup app object here, or use "that" convention and replace this with "return that;"
    }
})();
