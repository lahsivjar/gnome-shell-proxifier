const St = imports.gi.St;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;

function ProxySwitch(metadata)
{
    this.file = metadata.path + "/proxy.list";
    this._init.apply(this, arguments);
}	

let meta;
let p_switch;

ProxySwitch.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function()
    {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'proxy');

        this.statusLabel = new St.Label({
            text: "P",
            style_class: "proxy-label"
        });

        /** destroy all previously created children, and add our statusLabel **/
        this.actor.get_children().forEach(function(c) {
            c.destroy()
        });

	this.currentProxyFlag = -1;
        this.actor.add_actor(this.statusLabel);
	this.proxy = new Array();

	this._readProxy();
    },

    _readProxy : function()
    {	
	let pfile = this.file;
	let proxyMenu = this.menu;

	this.menu.removeAll();

	let p_addSection = new PopupMenu.PopupMenuSection();
	this.p_label = new St.Entry(
	{
		name: "newproxy",
		hint_text: "proxy-host:port",
		track_hover: false,
		can_focus: true
	});
	let newproxy = this.p_label.clutter_text;
	newproxy.connect('key-press-event', function(ob,event)
	{
		let symbol = event.get_key_symbol();
	    	if (symbol == Clutter.Return)
	    	{
			proxyMenu.close();
			let tempstr = ob.get_text().split(':');
			if(tempstr[1]!=undefined && tempstr[0]!='')
			{
				addProxy(tempstr, pfile);
	    			newproxy.set_text('');
			}
			else
			{
				newproxy.set_text('Invalid Proxy');
			}
		}
	});
	p_addSection.actor.add_actor(this.p_label);
	p_addSection.actor.add_style_class_name("newproxysection");
	this.menu.addMenuItem(p_addSection);
	this.Separator = new PopupMenu.PopupSeparatorMenuItem();
	this.menu.addMenuItem(this.Separator);

	let proxy_ar = new Array();
	let p_section = new PopupMenu.PopupMenuSection('ProxyList');
	if (GLib.file_test(this.file, GLib.FileTest.EXISTS))
	{
		let proxyFile = Shell.get_file_contents_utf8_sync(this.file);
			
		let proxyLine = proxyFile.toString().split('\n');
		let nProxy = 0;
			
		for (let i=0; i<proxyLine.length; i++)
		{
			if (proxyLine[i][0]!='#' && proxyLine[i]!='' && proxyLine[i]!='\n')
			{
				let p_port = proxyLine[i].toString().split(':');
				if(p_port[1]==undefined)
				{
					continue;
				}
				this.proxy[nProxy]  = new PopupMenu.PopupMenuItem(proxyLine[nProxy]);
				this.proxy[nProxy].proxyid = p_port[0];
				this.proxy[nProxy].port = p_port[1];
				this.proxy[nProxy].idx = nProxy;
				this.proxy[nProxy].connect('activate', Lang.bind(this, function(nProxy)
				{
					this._proxySwitch(nProxy);
				}));
				
				p_section.addMenuItem(this.proxy[i]);		
				nProxy++;
			}
		}
		this.menu.addMenuItem(p_section);

	}
	else 
	{ 
		global.logError("Proxifier : Error while reading file : " + this.file); 
	}
	
	this.Separator = new PopupMenu.PopupSeparatorMenuItem();
	this.menu.addMenuItem(this.Separator);

	let p_bottomSection = new PopupMenu.PopupMenuSection('remove');
	let removeProxy = new PopupMenu.PopupMenuItem('Remove Selected Proxy');
	let clearProxy = new PopupMenu.PopupMenuItem('No Proxy');
	removeProxy.connect('activate', Lang.bind(this, function()
	{
		if(this.currentProxyFlag!=-1)
		{
			removeSelected(this.proxy[this.currentProxyFlag], pfile);
			this.currentProxyFlag=-1;
		}
	}));
	clearProxy.connect('activate', Lang.bind(this, function()
	{
		let modeNone = new Gio.Settings({schema: "org.gnome.system.proxy"});
		modeNone.set_string('mode', 'none');
		if(this.currentProxyFlag!=-1)
		{
			this.proxy[this.currentProxyFlag].setShowDot(false);
			this.currentProxyFlag=-1;
		}
	}));
	p_bottomSection.addMenuItem(clearProxy);
	p_bottomSection.addMenuItem(removeProxy);
	this.menu.addMenuItem(p_bottomSection);
    },

    _proxySwitch : function(item)
    {	
	let modeManual = new Gio.Settings({schema: "org.gnome.system.proxy"});
	modeManual.set_string('mode', 'manual');

	let proxhttp = new Gio.Settings({schema: "org.gnome.system.proxy.http"});
	let proxhttps = new Gio.Settings({schema: "org.gnome.system.proxy.https"});
	let proxsocks = new Gio.Settings({schema: "org.gnome.system.proxy.socks"});
	let proxftp = new Gio.Settings({schema: "org.gnome.system.proxy.ftp"});
	
	let retValue = proxhttp.set_string('host', item.proxyid);
	retValue = retValue && proxhttp.set_int('port', item.port);
	retValue = retValue && proxhttps.set_string('host', item.proxyid);
	retValue = retValue && proxhttps.set_int('port', item.port);
	retValue = retValue && proxsocks.set_string('host', item.proxyid);
	retValue = retValue && proxsocks.set_int('port', item.port);
	retValue = retValue && proxftp.set_string('host', item.proxyid);
	retValue = retValue && proxftp.set_int('port', item.port);

	if(!retValue)
	{
		debug("Error in updating new proxies");
	}

	if(this.currentProxyFlag==-1)
	{
		this.proxy[item.idx].setShowDot(true);
	}
	else
	{
		this.proxy[this.currentProxyFlag].setShowDot(false);
		this.proxy[item.idx].setShowDot(true);
	}
	this.currentProxyFlag=item.idx;
    },

    _enable: function()
    {
	let fileM = Gio.file_new_for_path(this.file);
	this.monitor = fileM.monitor(Gio.FileMonitorFlags.NONE, null);
	this.monitor.connect('changed', Lang.bind(this, this._readProxy));
    },

    _disable: function()
    {
	this.monitor.cancel();
    }
}

function addProxy(text,file)
{
	if (GLib.file_test(file, GLib.FileTest.EXISTS))
	{
		let proxyFile = Shell.get_file_contents_utf8_sync(file);
		proxyFile = proxyFile + text[0] + ":" + text[1] + "\n";
		
		let f = Gio.file_new_for_path(file);
		let out = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
		Shell.write_string_to_stream (out, proxyFile);
		out.close(null);
	}
	else 
	{ 
		global.logError("Proxifier list : Error while reading file : " + file); 
	}
}

function removeSelected(item, file)
{
	if(GLib.file_test(file, GLib.FileTest.EXISTS))
	{
		let proxyFile = Shell.get_file_contents_utf8_sync(file);
		let newProxyArray = proxyFile.toString().split('\n');
		newProxyArray.splice(item.idx, 1);
		newProxyArray = newProxyArray.join('\n');

		let f = Gio.file_new_for_path(file);
		let out = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
		Shell.write_string_to_stream (out, newProxyArray.toString());
		out.close(null);
	}
	else
	{
		global.logError("Proxifier list : Error while reading file : " + file); 
	}
}

function debug(a)
{
    global.log(a);
    Util.spawn(['echo',a]);
}

function init(metadata) 
{ 
    meta=metadata;
}

function enable() 
{
	p_switch = new ProxySwitch(meta);
	p_switch._enable();
	Main.panel.addToStatusArea('proxy', p_switch);
}

function disable()
{
	p_switch._disable();
	p_switch.destroy();
	p_switch = null;
}
