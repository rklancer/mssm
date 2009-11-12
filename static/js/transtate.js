var tstate = (function () {

    var history_listeners = {};
    var inited = false;
    var tree = {}; // check on this?
    var on_change_mapping = {
        add: function (path, action) {
            if (!(this.hasOwnProperty(path))) {
                this[path] = [];
            }
            this[path].push(function () {
                action.apply(get_node(path).val, arguments);
            });
        }        
    };


    var get_node = function (path) {
        var node = tree;
        path = path.split(".");
        for (var i = 0; i < path.length; i++) {
            node = node.children[path[i]];
            if (node === undefined) {
                throw "path " + path + " not found.";
            }
        }
        return node;
    };


    var new_node = function () {
        return {
            name: "",
            path: "",
            val: null,
            parent: null,
            children: {},
            on_change_actions: []
        };
    };


    var get_raw_hash = function () {

        // Note MDC docs indicate Firefox has a bug in location.hash; it improperty decodes hash component.
        // However location.href does not, allowing us to uri-encode and uri-decode as desired.

        return (/#(.*)$/).exec(location.href)[1];
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
            if (hash_dict.hasOwnProperty[key] && history_listeners[key]) {
                listeners = history_listeners[key];

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

        console.log("loading " + new_hash + "into url");
        //$.history.load(new_hash);
    };


    var notify = function (path) {
        var actions = on_change_mapping[path];
        
        if (actions !== undefined) {
            for (var i = 0; i < actions.length; i++) {
                actions[i]();
            }
        }
        
        var child_name;
        var node = get_node(path);        
        for (child_name in node.children) {
            if (node.children.hasOwnProperty(child_name)) {
                notify(node.children[child_name].path);
            }
        }
    };
    
    
    var remove_callbacks = function (node) {
        var parent, child_name;
        
        if (node.parent) {
            // root node doesn't have/need a callback.
            parent = node.parent.val;
            parent.remove_listener(node.name, node.callback);
        }
        
        for (child_name in node.children) {
            if (node.children.hasOwnProperty(child_name)) {
                remove_callbacks(node.children[child_name]);
            }
        }
    };
    
    
    var subtree = function (name, parent) {
        var node = new_node();
        node.val = parent.val.get(name);

        node.name = name;
        node.path = (parent.path === "") ? node.name : parent.path + "." + node.name;
        node.parent = parent;
        node.callback = function () {
            console.log("in listener for node" + node);
            notify(node.path);
            remove_callbacks(node);
            parent.children[name] = subtree(name, parent);
        };
        parent.val.register_listener(name, node.callback);
        
        add_children(node);
        return node;
    };
    
    
    var add_children = function (node) {
        var child_name;
        
        if (typeof(node.val) === "object" && node.val.hasOwnProperty("get_properties")) {
            var props = node.val.get_properties();
            for (var i= 0; i < props.length; i++) {
                child_name = props[i];
                node.children[child_name] = subtree(child_name, node);
            }
        }
    };


    var init = function () {
        if (!inited) {
            console.log("initing jquery history with history_callback");
            //$.history.init(history_callback);
            inited = true;
        }
    };


    var tstate = function (path) {

        var node = get_node(path);

        var tstate_object = {};
        var method_name;

        init();


        // note we define these here, now, so they are wrapped in a closure with access to the correct value
        // of "node"
        

        var methods_to_add = {
            val: function () {
                return node.val;
            },
            on_change: function (action) {
                on_change_mapping.add(path, action);
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


        if (typeof(node.val) === "object" || typeof(node.val) === "function") {

            /* For convenience, copy methods from node.val to tstate_object, except any named "val",
               "on_change", etc. so you can do tstate("path").method() (if method is named "on_change" for
               some reason, you have to do tstate("path").val().on_change()) */

            for (method_name in node.val) {
                if (node.val.hasOwnProperty(method_name) &&
                  typeof(node.val[method_name]) === "function" &&
                  !methods_to_add.hasOwnProperty(method_name)) {

                    tstate_object[method_name] = (function (method_name) {
                        return function () {
                            return node.val[method_name].apply(node.val, arguments);
                        };
                    }(method_name));
                }
            }
        }


        for (method_name in methods_to_add) {
            if (methods_to_add.hasOwnProperty(method_name)) {
                // here, we can assume no references to "this"; so just copy the function w/o using apply()
                tstate_object[method_name] = methods_to_add[method_name];
            }
        }

        return tstate_object;
    };


    // need to cache values in tree so we're not walking the tree for every recursive call to bind_callbacks

    tstate.root = function (root_obj) {
        var root_node = new_node();
        root_node.val = root_obj;
        add_children(root_node);
        tree = root_node;
    };


    /* add_property_manager: mixin get, set, add_property and get_properties functionality */

    tstate.add_property_manager = function (obj) {

        // private store for properties goes here
        var props;
        var listeners = {};
        var setters = {};


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


        obj.remove_listener = function (prop, listener) {
            if (listeners[prop]) {
                for (var i = 0; i < listeners[prop].length; i++) {
                    if (listeners[prop][i] === listener) {
                        listeners[prop].splice(i,1);
                        return;
                    }
                }
            }
        };


        obj.set = function (prop, val) {
            if (!setters[prop]) {
                console.log("error: attempted to use public set method to set an un-settable property.");
                return;
            }

            setters[prop](val);
        };


        // return a protected "property manager" object that the client can keep secret

        var mgr = {};


        mgr.set = function (prop, val) {
            if (!props.hasOwnProperty(prop)) {
                throw "Property " + prop + " not found.";
            }
            props[prop] = val;

            var listener, nlisteners;
            if (listeners.hasOwnProperty(prop)) {
                for (var i = 0; i <listeners[prop].length; i++) {
                    console.log("calling listener, i = " + i);
                    listeners[prop][i]();
                }
            }
        };

        // accepts a list of strings and objects; the strings define new property names (default value: null)
        // objects have their keys copied over with the corresponding vals used as the initial value of those
        // keys

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


        /* Accepts a function that will be passed the value whenever tstate is called on to set property. //
           *** It is the responsibility of the setter function to call mgr.set() on the underlying property,
           so that listeners are notified.*** */

        mgr.setter = function (prop, setter) {
            setters[prop] = setter;
        };


        // tells tstate to allow setting this property in the "default" way, ie., just by calling mgr.set
        // without calling the special setter function defined in

        mgr.settable = function (prop) {
            setters[prop] = function (val) {
                mgr.set(prop, val);
            };
        };


        return mgr;
    };


    return tstate;
}());

/*

what needs to change:

1. throw an exception if no node found

2. callback should:

 1. notify down tree (do the on_change events)
 2. *rebuild* tree
 
3. tstate "on_change" should be register a list of names like "parent.child1.child2"

4. use bbq plugin for changes?

*/


setup = function () {
    r = {"bval": 1};
    pm = tstate.add_property_manager(r);
    pm.add("child1", "child2");
    pm.set("child1", "v1");
    c2 = {"c2val": 2}
    pm2 = tstate.add_property_manager(c2);
    pm2.add("child2child");
    pm2.set("child2child", "v2");
    pm.set("child2", c2);
    tstate.root(r);
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


// in listener
// making callback
// calling callback
