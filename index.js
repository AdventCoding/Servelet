'use strict';

const path = require('path'),
	fs = require('fs'),
	events = require('events'),
	serveletKey = Symbol('servelet');

/**
 * The Default Options
 * @typedef Defaults
 * @property {string} views The views folder
 * @property {string} partials The partials folder
 * @property {string} staticExt The static file extensions separated by a semi-colon
 * @property {string} dynamicExt The dynamic file extensions separated by a semi-colon
 * @property {*} globalData The data to send to all dynamic files (accessed by data.global)
 */
const defaults = {
	views: 'views',
	partials: 'views/partials',
	staticExt: 'html',
	dynamicExt: 'js',
	globalData: '',
};

/**
 * Create a new Servelet instance
 * @class
 * @param {Defaults} options The default options
 */
class Servelet {
	
	constructor (options = {}) {
		
		this.options = Object.assign({}, defaults, options);
		this.options.staticExt = this.options.staticExt.split(';');
		this.options.dynamicExt = this.options.dynamicExt.split(';');
		
		this.root = path.dirname(require.main.filename);
		this.viewDir = path.join(this.root, this.options.views, '/');
		this.partialDir = path.join(this.root, this.options.partials, '/');
		
		this.emitter = new events.EventEmitter();
		this.error = null;
		this.warning = null;
		this.ready = false;
		this.serves = []; // Queue for serve calls before module is ready
		
		// These objects contain page name and functions to retrieve page contents
		this.views = {};
		this.partials = {};
		
		// Initiate all valid pages for view and partial folders and handle any errors
		this.initAllPages((err) => {
			
			if (err) { return this.error = err; }
			this.serveAll();
			this.ready = true;
			
		});
		
	}
	
	get error () { return this._error; }
	set error (err) {
		
		if (err !== null) { this.emitter.emit('error', err); }
		this._error = err;
		
	}
	
	get warning () { return this._warning; }
	set warning (warn) {
		
		if (warn !== null) { this.emitter.emit('warning', warn); }
		this._warning = warn;
		
	}
	
	get ready () { return this._ready; }
	set ready (status) {
		
		if (status === true) { this.emitter.emit('ready'); }
		this._ready = status;
		
	}
	
	/**
	 * Serve all requests that were initiated before module was ready
	 * @return void
	 */
	serveAll () { this.serves.forEach((s) => s()); }
	
	/**
	 * Locates and stores all dynamic and/or static pages in the view and partial folders
	 * @param {string=} type The type of file to locate
	 * @param {function(Error)} cb The callback function for error or completion
	 * @return void
	 */
	initAllPages (type, cb) {
		
		// type is optional / check for callback
		if (typeof type === 'function') {
			
			cb = type;
			type = 'all';
			
		}
		
		let completed = 0;
		const total = 2, // The total amount of scan calls to make
			/**
			 * Scan for pages within a directory and initialize them
			 * @param {string} dir The directory to search in
			 * @return void
			 */
			scan = (dir) => {
				
				fs.readdir(dir, (err, files) => {
					
					if (err) {
						
						// Callback on initAllPages completion will never fire
						// because files in this readdir call are never initiated
						return cb(err);
						
					}
					
					let completedFiles = 0,
						totalFiles = files.length,
						/**
						 * Check if all async calls are complete
						 * @return void
						 */
						checkCompletion = () => {
							
							if (completedFiles === totalFiles) {
								
								// All files in directory have been scanned
								if (++completed === total) {
									
									// All readdir calls are complete
									cb(null);
									
								}
								
							}
							
						},
						/**
						 * Complete the current file scan
						 * @param {Error|null} err The error from file init or null
						 * @return void
						 */
						fileComplete = (err) => {
							
							if (err) { return cb(err); }
							completedFiles += 1;
							checkCompletion();
							
						};
					
					if (totalFiles === 0) {
						
						// Empty directory
						checkCompletion();
						
					} else {
						
						files.forEach((file) => {
							
							let page = path.parse(file),
								ext = page.ext.replace('.', '');
							
							if ((type === 'static' || type === 'all')
								&& this.options.staticExt.indexOf(ext) >= 0) {
								this.initStaticPage(dir, page, fileComplete);
							} else if ((type === 'dynamic' || type === 'all')
								&& this.options.dynamicExt.indexOf(ext) >= 0) {
								this.initDynamicPage(dir, page, fileComplete);
							} else {
								
								// Skip the file for wrong extension type
								fileComplete(null);
								
							}
							
						});
						
					}
					
				});
				
			};
		
		scan(this.viewDir);
		scan(this.partialDir);
		
	}
	
	/**
	 * Initialize a static page to the views or partials object
	 * @param {string} dir The directory of the page
	 * @param {Object} page The path.parse object for the page
	 * @param {Function} cb The callback function for error or completion
	 * @return void
	 */
	initStaticPage (dir, page, cb) {
		
		const displayType = (dir === this.viewDir) ? 'views' : 'partials';
		
		// Cache the file content for the static page
		// and use a helper function to retrieve the content
		this.getStaticFile(dir + page.base, (err, content) => {
			
			if (err) { return cb(err); }
			this[displayType][page.name] = () => content;
			this[displayType][page.name]['type'] = 'static';
			this[displayType][page.name]['ext'] = page.ext;
			cb(null);
			
		});
		
	}
	
	/**
	 * Initialize a dynamic page to the views or partials object
	 * @param {string} dir The directory of the page
	 * @param {Object} page The path.parse object for the page
	 * @param {Function} cb The callback function for error or completion
	 * @return void
	 */
	initDynamicPage (dir, page, cb) {
		
		const displayType = (dir === this.viewDir) ? 'views' : 'partials',
			loc = this[displayType],
			name = page.name;
		
		// Get the dynamic page content by requiring the file
		try {
			
			loc[name] = require(dir + page.base);
			
			if (typeof loc[name] !== 'function') {
				this.warning = `The ${name} dynamic page did not export a module to build the page content.`;
				loc[name] = () => {};
			}
			
			loc[name]['type'] = 'dynamic';
			loc[name]['ext'] = page.ext;
			cb(null);
			
		} catch (e) {
			
			// Reset page to return empty string for its content
			loc[name] = () => '';
			loc[name]['type'] = 'dynamic';
			loc[name]['ext'] = page.ext;
			return cb(e);
			
		}
		
	}
	
	/**
	 * Get the content of a static page file
	 * @param {string} fname The absolute file name to load from the views folder
	 * @param {function(Error, string)} cb The callback to handle an error and the file content
	 * @return void
	 */
	getStaticFile (fname, cb) {
		
		fs.readFile(fname, 'utf8', (err, data) => {
			
			if (err) { return cb(err); }
			cb(null, data);
			
		});
		
	}
	
	/**
	 * Load a page based on static or dynamic extension
	 * @param {string=} page The page name to load. Defaults to 'index'
	 * @param {Object=} data The data object to send to the dynamic page
	 * @param {bool} layout If the page is a layout
	 * @return {string} The compiled content from the loaded page
	 */
	loadPage (page = 'index', data = {}, layout = false) {
		
		let res = '';
		
		if (this.views.hasOwnProperty(page)) {
			
			// All pages in the views object will have either static or dynamic extensions
			// and have a function (unless an error occurred) that returns a string of the content
			try {
				
				// If using a layout, the data object has already been created
				let allData = (layout) ? data : this.createDataObject(data);
				
				// A static page will just ignore the object sent to it
				res = this.views[page](allData);
				
			} catch (err) {
				
				// Catch any errors that happen within the dynamic page
				this.error = err;
				return `An error has occurred within the dynamic ${page} page.`;
				
			}
			
			return res;
			
		} else {
			
			res = `The ${page} page could not be found.`;
			this.error = new Error(res);
			
			return res;
			
		}
		
	}
	
	/**
	 * Include one or more partial files into a dynamic page
	 * @param {string|string[]} page A page name or array of page names to include from the partials
	 * @param {Object=} data An object of data to send to the partial page
	 * @return void
	 */
	includePartial (page, data = {}) {
		
		if (Array.isArray(page)) {
			
			page.forEach((p) => { this.includePartial(p, data); });
			
		} else {
			
			if (this.partials.hasOwnProperty(page)) {
				
				try {
					
					let content = this.partials[page](data);
					return content;
					
				} catch (e) {
					
					this.error = e;
					return '';
					
				}
				
			} else {
				
				this.error = new Error(`Could not find the ${page} include file.`);
				return '';
				
			}
			
		}
		
	}
	
	/**
	 * Create the dynamic page data object
	 * @param {Object} data The initial data object
	 * @return {Object}
	 */
	createDataObject (data) {
		
		let dataObj = Object.assign({}, data);
		
		dataObj.global = this.options.globalData;
		dataObj.include = (page, newData) => { return this.include(dataObj, page, newData); };
		dataObj.layout = (page, ...html) => { return this.layout(dataObj, page, html); };
		
		return dataObj;
		
	}
	
	/****************/
	/** API Methods */
	/****************/
	
	/**
	 * Include a partial file
	 * @param {Object} data The original data object
	 * @param {string} page The page name to include
	 * @param {Object=} newData Any new data to pass through
	 * @return {string} The html string from the include
	 */
	include (data, page, newData) {
		
		return this.includePartial(
			page,
			Object.assign({}, data, newData)
		);
		
	}
	
	/**
	 * Include a layout view
	 * @param {Object} data The original data object
	 * @param {string} page The layout name with optional view names that bind to the data object
	 * (e.g. 'layout:body' or 'layout:section1:section2)
	 * @param {string[]} html The array of html string(s) to bind to the data object sent to the layout
	 * @return {string} The html string from the layout
	 */
	layout (data, page, html) {
		
		let pages = page.split(':'),
			htmlData = {};
		
		if (pages && page[0]) {
			
			// Assign the html to the layout variable and add the original data
			for (let i = 1; i < pages.length; i += 1) {
				htmlData[pages[i]] = html[i - 1] || '';
			}
			
			Object.assign(data, htmlData);
			
			// Load the layout page with the new data
			return this.loadPage(pages[0], data, true);
			
		} else {
			
			return html;
			
		}
		
	}
	
}

/**
 * Create the API class for the export
 * @class
 * @param {Defaults} options The default options
 */
class API {
	
	constructor (options) {
		
		this[serveletKey] = new Servelet(options);
		
	}
	
	/**
	 * The error that occurred or null
	 * @return {Error|null}
	 */
	get error () { return this[serveletKey].error; }
	
	/**
	 * If the servelet instance is ready to serve
	 * @return {boolean}
	 */
	get ready () { return this[serveletKey].ready; }
	
	/**
	 * Update the global data object that is passed to all dynamic pages
	 * @param {Object} data The object to update the dynamic data with
	 * @return {Object} The servelet instance
	 */
	updateGlobalData (data) {
		
		Object.assign(this[serveletKey].options.globalData, data);
		return this;
		
	}
	
	/**
	 * Serves dynamic or static pages in the views folder as compiled text
	 * Use the on('error', callback) method to catch errors.
	 * @param {string} page The page name to serve from the views folder
	 * @param {Object=} data The object to pass into a dynamic page
	 * @param {function(Error, string)=} callback The optional callback for completion
	 * @return {Object|string} The servelet instance if using callback, else the page data string
	 */
	/**
	 * Serves dynamic or static pages in the views folder as compiled text
	 * Use the on('error', callback) method to catch errors.
	 * @param {string} page The page name to serve from the views folder
	 * @param {function(Error, string)=} callback The optional callback for completion
	 * @return {Object|string} The servelet instance if using callback, else the page data string
	 */
	serve (page, data = {}, callback) {
		
		// Overload
		if (typeof data === 'function') {
			
			callback = data;
			data = {};
			
		}
		
		if (!this.ready) {
			
			// Queue the serve call until Module is ready
			this[serveletKey].serves.push(() => {
				this.serve(page, data, callback);
			});
			
			return this;
			
		}
		
		const str = this[serveletKey].loadPage(page, data);
		
		if (typeof callback === 'function') {
			
			callback(str);
			return this;
			
		} else {
			
			return str;
			
		}
		
	}
	
	/**
	 * Add an event listener for one of these events: 'error', 'warning', 'ready'
	 * @param {string} event The event to listen for
	 * @param {Function} callback The callback function
	 * @return {Object} The servelet instance
	 */
	on (event, callback) {
		
		this[serveletKey].emitter.addListener(event, callback);
		return this;
		
	}
	
	/**
	 * Remove an event listener for one of these events: 'error', 'warning', 'ready'
	 * @param {string} event The event to listen for
	 * @param {Function} callback The callback that was used in the 'on' method call
	 * @return {Object} The servelet instance
	 */
	off (event, callback) {
		
		this[serveletKey].emitter.removeListener(event, callback);
		return this;
		
	}
	
	/**
	 * Reload one or more static pages in the servelet Cache
	 *   Omit page argument to reload all static pages.
	 * @param {(string|string[])=} page An optional page name or array of page names
	 * @param {Function(Error|null)} callback The callback function for error or completion
	 * @return {Object} The servelet instance
	 */
	reloadStaticPage (page, callback) {
		
		// page is optional / check for callback
		if (typeof page === 'function') {
			
			callback = page;
			page = null;
			
		}
		
		const serve = this[serveletKey];
		let complete = (err) => {
			
			if (err) { return callback(err); }
			callback(null);
			
		};
		
		if (Array.isArray(page)) {
			
			page.forEach(this.reloadStaticPage.bind(this));
			
		} else if (typeof page === 'string') {
			
			let dir = '',
				file = '',
				ext = serve.options.staticExt,
				view = (serve.views.hasOwnProperty(page))
					? serve.views[page] : null,
				partial = (serve.partials.hasOwnProperty(page))
					? serve.partials[page] : null;
			
			if (view && ext.indexOf(view.ext.replace('.', '')) >= 0) {
				
				dir = serve.viewDir;
				file = page + view.ext;
				
			} else if (partial && ext.indexOf(partial.ext.replace('.', '')) >= 0) {
					
				dir = serve.partialDir;
				file = page + partial.ext;
				
			} else {
				
				callback(new Error(`Could not reload the static ${page} page, since it was never initialized.`));
				return this;
				
			}
			
			// Re-initialize a single static page
			serve.initStaticPage(dir, path.parse(file), complete);
			
		} else {
			
			// Re-initialize all static pages
			serve.initAllPages('static', complete);
			
		}
		
		return this;
		
	}
	
}

/**
 * Servelet Node.js Module
 * @author Michael S. Howard
 * @license MIT
 * @param {Defaults} options The default options to use with the servelet instance
 */
module.exports = (options) => new API(options);
