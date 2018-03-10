# servelet

Servelet is a simple module to serve dynamic page modules and static pages. A dynamic page module will export a function that receives a data object that is used to build the dynamic page.

## Install

```sh
npm install servelet
```

## Example

When servelet is required, it will search all files in the 'views' and 'partials' folders for static and dynamic files. By setting the staticExt and dynamicExt options we tell the module to look for static .htm or .html, and dynamic .js files.

```js
const servelet = require('servelet')({
	views: 'views',
	partials: 'views/partials',
	staticExt: 'htm;html',
	dynamicExt: 'js',
	globalData: { gValue: 123 }
});
```

----------
Here is an example of a dynamic .js file that uses custom data, global data, and the include method to include a file from the 'views/partials' folder. This file points out the ease of using JavaScript template literals for building dynamic content.

```js
// index.js
module.exports = (data) => `
<!DOCTYPE html>
<html lang="en">
${data.include('head', data) /* The head.js include uses the custom data.title to set the page's title */}
<body>
	<p>This is a global value: ${data.global.gValue}.</p>
	<p>These are custom values: ${(data.validUser) ? `Welcome ${data.userName}` : 'Welcome'}</p>
</body>
`;
```

----------
Then we can serve the page in a GET request through Express, and feed in our custom values.

```js
let app = require('express')();
app.get('/', (req, res) => {
	res.send(servelet.serve('index', { title: 'Home Page', validUser: true, userName: 'Michael' }));
});
```

## API

```js
let servelet = require('servelet')(options);
```

### Properties

These are the properties on the servelet instance:

```js
servelet.error = Error || null; // The most recent error if any
servelet.ready = true || false; // If the module has set up all the dynamic and static pages
```

### Methods

#### .serve

Gets the content of dynamic or static pages.

```js
app.get('/', (req, res) => {
	res.send(servelet.serve('home'));
});
app.get('/about', (req, res) => {
	const userData = getTheUserData(); // Make use of some data that alters the about page
	servelet.serve('about', { title: 'About Us', user: userData }, (page) => {
		res.send(page); // Send the compiled page text to the response
	});
});
```

#### .on && .off

Register for events with the 'on' method. To unregister, use the 'off' method, sending in the callback function that was used in the 'on' method.

```js
servelet.on('error', myErrorCallback)
	.on('warning', (w) => { console.log('Warning: ' + w); })
	.on('ready', () => { console.log('Servelet is ready.'); });

servelet.off('error', myErrorCallback);
```

#### .updateGlobalData

Updates the global data object that is sent to all dynamic pages.

```js
// app.js
let servelet = require('servelet')({
	globalData: { dynamicId: 342 }
});
servelet.updateGlobalData({ dynamicId: 738 });
res.send(servelet.serve('index'));
----------
// index.js
module.exports = (data) => `<p>The ID is: ${data.globalData.dynamicId}</p>`;
// HTML Response: <p>The ID is: 738</p>
```

#### .reloadStaticPage

Reload a static page in the servelet cache. This is useful with a GET request to reload one or more static pages that have been altered on the server.

```js
servelet.reloadStaticPage(callback); // Reloads all static pages
servelet.reloadStaticPage('index', callback);
servelet.reloadStaticPage(['index', 'nav'], callback);
```

## License

MIT