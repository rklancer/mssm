var tstate = (function () {

    var history_listeners = {};
    var inited = false;
    var tree = {};
    var undefined;
    
    var init = function () {
        if (!inited) {
            //console.log("initial trigger of hashchange event");
            $(window).trigger("hashchange");
            inited = true;
        }
    };
    
        
    var on_change_mapping = {
        add: function (path, action) {
            if (!(this.mapping.hasOwnProperty(path))) {
                this.mapping[path] = [];
            }
            this.mapping[path].push(action);
        },
        mapping : {}
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


    var notify = function (notify_path_root) {
        var actions, path, node, val;
        
        for (path in on_change_mapping.mapping) {
            if (on_change_mapping.mapping.hasOwnProperty(path)) {
                if(path.substring(0, notify_path_root.length) === notify_path_root) {
                    actions = on_change_mapping.mapping[path];
                    try {
                        node = get_node(path);
                    }
                    catch(err) {
                        // we can implement typed errors later...
                        node = undefined;
                    }
                    val = (node === undefined) ? undefined : node.val;

                    for (var i = 0; i < actions.length; i++) {
                        actions[i](val);
                    }
                }
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
            // called whenever parent object's set method is called to change the property represented by this
            // node
            //console.log("in node-change callback");
            
            // ignore the callback from set() if the new value (parent.val.get(name)) is exactly the same
            // as the old value (node.val). (This is less useful than it might seem given javascript's lack
            // of a good notion of equality of, for example, arrays;
            //    [1] == [1] --> false
            
            // *** so: allow user to define an equality operator? ***
            
            if (node.val !== parent.val.get(name)) {
                // update the tstate tree with new values *before* notifying observers of the change!                
                parent.children[name] = subtree(name, parent);  
                notify(node.path);
                remove_callbacks(node);
            }
        };
        parent.val.register_listener(name, node.callback);
        
        add_children(node);
        return node;
    };
    
    
    var add_children = function (node) {
        var child_name;
        
        // note the below has to check if node.val === null because (absurdly) typeof(null) is "object"
        if (typeof(node.val) === "object" 
              && node.val !== null
              && node.val.hasOwnProperty("get_properties")) {
            var props = node.val.get_properties();
            for (var i= 0; i < props.length; i++) {
                child_name = props[i];
                node.children[child_name] = subtree(child_name, node);
            }
        }
    };


    var tstate = function (path) {

        var node;
        
        try {
            node = get_node(path);
        }
        catch (err) {
            node = null;
        }

        var tstate_object = {};
        var method_name;

        init();


        var methods_to_add = {
            val: function () {
                try {
                    node = get_node(path);
                }
                catch (err) {
                    return null;
                }
                return node.val;
            },
            
            on_change: function (action) {
                // NOTE for doc: actions are not allowed to refer to "this"?
                on_change_mapping.add(path, action);
            },
            
            hist: function (hash_key) {
                on_change_mapping.add(path, function () {
                    var node = get_node(path);
                    var new_state = {};
                    new_state[hash_key] = node.val;
                    
                    //console.log("writing state '" + node.val + "' to key '" + hash_key + "'.");
                    
                    $.bbq.pushState(new_state);
                });

                $(window).bind('hashchange', function (e) {
                    
                    // FIXME: unsure what to do if state isn't *in* hash to start with.
                    
                    var new_val = $.bbq.getState(hash_key, true) || '';
                    var node = get_node(path);
                    //console.log("read state '" + new_val + "' from key '" + hash_key + "'.");
                    if (new_val !== node.val) {
                        //console.log("  (state changed, old val was '" + node.val + "'.)");
                        node.parent.val.set(node.name, new_val);
                    }
                });
                
                $(window).trigger('hashchange');
            }
        };


        if (node && (typeof(node.val) === "object" || typeof(node.val) === "function")) {

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
                            console.log("executing: " + method_name + "on node: " + node.path);
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
        var undefined;
        

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
                //console.log("error: attempted to use public set method to set an un-settable property.");
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

            var listener;
            if (listeners.hasOwnProperty(prop)) {
                for (var i = 0; i < listeners[prop].length; i++) {
                    //console.log("calling listener, i = " + i);
                    listeners[prop][i]();
                }
            }
        };

        // accepts a list of strings and objects; the strings define new property names (default value: null)
        // objects have their keys copied over with the corresponding vals used as the initial value of those
        // keys

        mgr.add = function () {

            props = props || {};

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


setup = function () {
    r = {"bval": 1};
    pm = tstate.add_property_manager(r);
    pm.add("child1", "child2");
    pm.set("child1", "v1");
    c2 = {"c2val": 2};
    pm2 = tstate.add_property_manager(c2);
    pm2.add("child2child");
    pm2.set("child2child", "v2");
    pm.set("child2", c2);
    tstate.root(r);
    
    pm2.settable("child2child");
    tstate("child2.child2child").hist("c2c");
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

