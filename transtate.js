var tstate = function (selector) {

    var node = get_node(selector);

    var prop_val = node.val;
    var ret_obj, method_name;


    var methods_to_add = {
        val: function () {
            return prop_val;
        },

        on_change: function (action) {
            node.on_change_action = function () {
                action.apply(node.val, arguments);
            );
        },
        // ???
        hist: function (hash_key) {
            register_listener(parsed_selector, function () {
                write_to_hash(hash_key, get_value(parsed_selector));
            });

            register_history(hash_key, function (hash_val) {
                set_value(parsed_selector, hash_val);
            };
        },

        set: function (val) {
            //??
        };
    };


    if (is_object(prop_val)) {

        /* For convenience, copy methods from prop_val to ret_obj, except any named "val", "on_change", etc.
           so you can do tstate("selector").method() (if method is named "on_change" for some reason, you have
           to do tstate("selector").val().on_change()) */

        for (method_name in prop_val) {
            if (prop_val.hasOwnProperty(method_name)
                && typeof(prop_val[method_name]) === "function"
                && !methods_to_add.hasOwnProperty(method_name)) {

                ret_obj[method_name] = function () {
                    return prop_val[method_name].apply(prop_val, arguments);
                }
            }
        }
    }
    else {
        // we'll add a 'val' method to this object, which allows us to access the underlying property value
        ret_obj = {};
    }


    for (method_name in methods_to_add) {
        if (methods_to_add.hasOwnProperty(method_name) {
            // here, we can assume no references to "this"; so just copy the function w/o using apply()
            ret_obj[method_name] = methods_to_add[method_name];
        }
    }


    return ret_obj;
};


var new_node = function () {
    return {
        name: "",
        obj: null,
        parent: null,
        children: {},
        on_change_action: null
    };
}


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
        if children.hasOwnProperty(child_name) {
            bind_callbacks_and_values(node.children[child_name]);
        }
    }
};


var notify_down_tree(node) {
    var child_name;

    if (node.on_change_action) {
        node.on_change_action();
    }

    for (child_name in node.children) {
        if children.hasOwnProperty(child_name) {
            notify_down_tree(node.children[child_name]);
        }
    }
};



var is_object = function (x) {

};


var get_node = function (selector) {
    var node = tstate.tree;

    selector = selector.split(".");

    for (var i = 0; i < selector.length; i++) {
        node = node.children[selector[i]];
    }

    return node;
}


var write_to_hash = function (hash_key, val) {
};


var register_history = function () {
    // use jquery history plugin
}


/* add_property_manager: mixin get, set, add_property and get_properties functionality */

tstate.add_property_manager = function (obj) {

        // private store for properties goes here
        var props = {};
        var listeners = {};


        obj.get_properties = function () {
            ;
        }

        obj.get = function (prop) {
            ;
        }


        obj.register_listener = function (prop, action) {
            if (!listeners[prop]) {
                listeners[prop] = [];
            }

            listeners[prop].push(action);
        }

        obj.unregister_listener = function (prop, listener) {
            if (listeners[prop]) {
                for (var i = 0; i < listeners.length; i++) {
                    if (listeners[prop][i] === listener) {
                        listeners.splice(i,1);
                        return;
                    }
                }
            }
        }

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
        }

        mgr.add = function () {
            // read the property list from that arguments array-like object

            // *** must handle lists, objects (w/default values), and long argument list transparently
        }

        // accepts a function that will be passed the value whenever tstate is called on to set property
        mgr.setter = function (prop, setfunc) {
            ;
        }

        // tells tstate to allow setting this property in the "default" way, ie., just by calling mgr.set
        // without calling the special setter function defined in
        mgr.settable = function (prop) {
            ;
        };

        return mgr;
    }
};



/* note usages:

        // tstate global must have add_property_manager method
        tstate.add_property_manager(that)

        // but tstate must itself be a function, which returns objects that have a val method:
        tstate("base.url").val()

        // moreover it must copy over methods from the objects it wraps, to allow this shorthand:
        tstate("groups_def").set_source("url", grplink.attr("href"));    // *groups_def* defines set_source()!

        // furthermore, the objects must have some way to associate methods like seturl with the tstate
        // "set" method so that--for those properties which are relevant--the following can work:
        tstate("base.url").set( ... )       // not every property gets a "set" method
*/
