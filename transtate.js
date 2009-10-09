var get_node = function (selector) {
    var node = tstate.tree;

    selector = selector.split(".");

    for (var i = 0; i < selector.length; i++) {
        node = node.children[selector[i]];
    }

    return node;
};


var new_node = function () {
    return {
        name: "",
        obj: null,
        parent: null,
        children: {},
        on_change_actions: []
    };
};


var get_raw_hash = function () {

    // Note MDC docs indicate Firefox has a bug in location.hash; it improperty decodes hash component.
    // However location.href does not, allowing us to uri-encode and uri-decode as desired.

    return /#(.*)$/.exec(location.href)[1];
};


var raw_hash_to_dict = function (hash) {
    var re = /([^=&]+)=?([^&]+)/g;
    var re_results;
    var hash_dict = {};
    var key, val;

    while ((re_results = re.exec(hash)) !== null) {
        key = decodeURIComponent(re_results[1]);
        val = decodeURIComponent(re_results[2]);
        hash_dict[key] = val;
    }

    return hash_dict;
};


var history_callback = function (hash) {

    var hash_dict = raw_hash_to_dict(get_raw_hash());
    var listeners;
    var key;

    for (key in hash_dict) {
        if (hash_dict.hasOwnProperty[key] && tstate.history_listeners[key]) {
            listeners = tstate.history_listeners[key];

            for (var i = 0; i < listeners.length; i++) {
                listeners[i](hash_dict[key]);
            }
        }
    }
};


// NOTE we'll want to use a modified version of the history plugin, or write our own, so that the callback
// does not get called after changing the hash.

var write_to_hash = function (key, val) {

    var hash_dict = raw_hash_to_dict(get_raw_hash);

    hash_dict[key] = val;

    // Javascript offers no guarantees as to the order in which we iterate keys, so enforce an ordering
    var keys = [];
    var hkey;

    for (hkey in hash_dict) {
        if (hash_dict.hasOwnProperty(hkey)) {
            keys.push(hkey);
        }
    }
    keys.sort();

    var new_hash = [];

    for (var i = 0; i < keys.length; i++) {
        new_hash.push([
            encodeURIComponent(keys[i]),
            "=",
            encodeURIComponent(hash_dict[keys[i]])
        ].join(""));
    }

    new_hash = new_hash.join("&");

    $.history.load(new_hash);
};


var notify_down_tree = function (node) {
    var child_name;

    for (var i = 0; i < node.on_change_actions.length; i++) {
        node.on_change_actions[i]();
    }

    for (child_name in node.children) {
        if (node.children.hasOwnProperty(child_name)) {
            notify_down_tree(node.children[child_name]);
        }
    }
};


var make_callback = function (node) {
    return function () {
        bind_callbacks_and_values(node);
        notify_down_tree(node);
    };
};


var bind_callbacks_and_values = function (node) {

    var parent, child_name;

    if (node.parent) {
        // root node doesn't have/need a callback.
        parent = node.parent.val;
        parent.unregister_listener(node.name, node.callback);

        node.callback = make_callback(node);
        parent.register_listener(node.name, node.callback);

        node.val = parent.get(node.name);
    }

    for (child_name in node.children) {
        if (node.children.hasOwnProperty(child_name)) {
            bind_callbacks_and_values(node.children[child_name]);
        }
    }
};


var tstate = function (selector) {

    var node = get_node(selector);

    var prop_val = node.val;
    var ret_obj, method_name;

    tstate.init();

    // note we want to keep these wrapped in a closure with access to the correct value of "node"

    var methods_to_add = {
        val: function () {
            return prop_val;
        },

        on_change: function (action) {
            node.on_change_actions.push(function () {
                action.apply(node.val, arguments);
            });
        },
        // make a second on_change_action for history; no unregistering?

        hist: function (hash_key) {
            node.on_change_actions.push(function () {
                write_to_hash(hash_key, node.val);
            });

            tstate.history_listeners[hash_key].push(function (hash_val) {
                node.val.set(hash_val);
            });
        }
    };


    if (typeof(prop_val) === "object" || typeof(prop_val) === "function") {

        /* For convenience, copy methods from prop_val to ret_obj, except any named "val", "on_change", etc.
           so you can do tstate("selector").method() (if method is named "on_change" for some reason, you have
           to do tstate("selector").val().on_change()) */

        for (method_name in prop_val) {
            if (prop_val.hasOwnProperty(method_name) &&
              typeof(prop_val[method_name]) === "function" &&
              !methods_to_add.hasOwnProperty(method_name)) {

                ret_obj[method_name] = (function (method_name) {
                    return function () {
                        return prop_val[method_name].apply(prop_val, arguments);
                    };
                }(method_name));
            }
        }
    }
    else {
        // we'll add a 'val' method to this object, which allows us to access the underlying property value
        ret_obj = {};
    }


    for (method_name in methods_to_add) {
        if (methods_to_add.hasOwnProperty(method_name)) {
            // here, we can assume no references to "this"; so just copy the function w/o using apply()
            ret_obj[method_name] = methods_to_add[method_name];
        }
    }


    return ret_obj;
};


tstate.history_listeners = {};


tstate.init = function () {
    if (!tstate.inited) {
        $.history.init(history_callback);
        tstate.inited = true;
    }
};


// need to cache values in tree so we're not walking the tree for every recursive call to bind_callbacks

tstate.root = function (root_obj) {

    tstate.tree = new_node();

    var build_tree = function (node, obj) {
        var props, prop_name, child_node;

        if (typeof(obj) === "object" && obj.hasOwnProperty("get_properties")) {
            props = obj.get_properties();
            for (var i= 0; i < props.length; i++) {
                prop_name = props[i];

                child_node = new_node();
                child_node.name = prop_name;
                child_node.parent = node;

                node.children[prop_name] = child_node;

                build_tree(child_node, obj.get(prop_name));
            }
        }
    };

    build_tree(tstate.tree, root_obj);

    bind_callbacks_and_values(tstate.tree);
};



/* add_property_manager: mixin get, set, add_property and get_properties functionality */

tstate.add_property_manager = function (obj) {

    // private store for properties goes here
    var props;
    var listeners = {};


    obj.get_properties = function () {
        var prop;
        var prop_names = [];

        for (prop in props) {
            if (props.hasOwnProperty(prop)) {
                prop_names.push(prop);
            }
        }
        return prop_names;
    };


    obj.get = function (prop) {
        return props[prop];
    };


    obj.register_listener = function (prop, action) {
        if (!listeners[prop]) {
            listeners[prop] = [];
        }

        listeners[prop].push(action);
    };


    obj.unregister_listener = function (prop, listener) {
        if (listeners[prop]) {
            for (var i = 0; i < listeners.length; i++) {
                if (listeners[prop][i] === listener) {
                    listeners.splice(i,1);
                    return;
                }
            }
        }
    };

    // return a protected "property manager" object that the client can keep secret

    var mgr = {};


    mgr.set = function (prop, val) {
        props[prop] = val;

        var listener;

        for (listener in listeners[prop]) {
            if (listeners.hasOwnProperty(listener)) {
                listeners[listener]();
            }
        }
    };

    // accepts a list of strings and objects; the strings define new property names (default value: null)
    // objects have their keys copied over with the corresponding vals used as the initial value of those keys

    mgr.add = function () {
        if (props !== undefined) {
            console.log("error: attempted to define property list twice!");
            return;
        }
        props = {};

        var arg, key, i;

        for (i = 0; i < arguments.length; i++) {
            arg = arguments[i];

            if (typeof arg === "string") {
                props[arg] = null;
            }
            else if (typeof arg === "object") {
                for (key in arg) {
                    if (arg.hasOwnProperty(key)){
                        props[key] = arg[key];
                    }
                }
            }
        }
    };


    // accepts a function that will be passed the value whenever tstate is called on to set property
    mgr.setter = function (prop, setfunc) {
        obj.set = setfunc;
    };


    // tells tstate to allow setting this property in the "default" way, ie., just by calling mgr.set
    // without calling the special setter function defined in
    mgr.settable = function (prop) {
        obj.set = mgr.set;
    };


    return mgr;
};


/* note usages:

        // properties of root_obj are the likes of "base", "seq-table", etc
        tstate.root(root_obj)

        // but tstate must itself be a function, which returns objects that have a val method:
        tstate("base.url").val()

        // moreover it must copy over methods from the objects it wraps, to allow this shorthand:
        tstate("seq-table.instance.groups_def").set_source("url", grplink.attr("href"));

        // furthermore, the objects must have some way to associate methods like seturl with the tstate
        // "set" method so that--for those properties which are relevant--the following can work:
        tstate("base.url").set( ... )       // not every property gets a "set" method
*/
