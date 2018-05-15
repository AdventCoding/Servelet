# servelet

Servelet is a simple Node.js module to serve dynamic page modules and static pages. A dynamic page module exports a function that receives a data object that is used to build the dynamic page using JavaScript template literals.

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
// Exports a function that returns a template literal, using properties and methods of the data parameter
module.exports = (data) => `
<!DOCTYPE html>
<html lang="en">
${data.include('head')}
<body>
  <p>This is a global value: ${data.global.gValue}.</p>
  <p>These are custom values: ${(data.validUser) ? `Welcome ${data.userName}` : 'Welcome Guest'}</p>
</body>
`;
```

----------
Then we can serve the page in a GET request through Express, and feed in our custom values.

```js
const app = require('express')();
app.get('/', (req, res) => {
  
  res.send(servelet.serve('index', {
    title: 'Home Page',
    validUser: true,
    userName: 'Michael',
  }));
  
// OR
  
  servelet.serve('index', { title: 'Home' }, (html) => {
    res.send(html);
  });
  
});
```

## API

```js
let servelet = require('servelet')(options);
```

### Properties and Methods

### .error

Get the most recent error object, or null

### .ready

If the module has set up all the dynamic and static pages

### .serve(page, data, callback)

Get the content of dynamic or static pages.
 - page : The page name to serve from the views folder
 - data : The object to pass into a dynamic page
 - callback : The optional callback for completion

```js
app.get('/', (req, res) => {
  
  res.send(servelet.serve('home'));
  
});
app.get('/about', (req, res) => {
  
  const userData = getTheUserData(); // Make use of some data that alters the about page
  servelet.serve('about', { title: 'About Us', user: userData }, (html) => {
    res.send(html); // Send the compiled page text to the response
  });
  
});
```

### .updateGlobalData(data)

Update the global data object that is sent to all dynamic pages.
 - data {Object} : The object to update the global data with

```js
// app.js
const servelet = require('servelet')({
  globalData: { dynamicId: 342 }
});

servelet.updateGlobalData({ dynamicId: 738 });
res.send(servelet.serve('index'));

----------

// index.js
module.exports = (data) => `
<p>The ID is: ${data.globalData.dynamicId}</p>
`;
// HTML Response: <p>The ID is: 738</p>
```

### .on(event, callback)

Add an event listener for an event.
 - event {string} : 'error', 'warning', or 'ready'
 - callback {Function} : The callback for the event listener

```js
servelet.on('error', myErrorCallback)
  .on('warning', (w) => { console.log('Warning: ' + w); })
  .on('ready', () => { console.log('Servelet is ready.'); });
```

### .off(event, callback)

Remove an event listener for an event.
 - event {string} : 'error', 'warning', or 'ready'
 - callback {Function} : The callback that was used in the .on method call

```js
servelet.off('error', myErrorCallback);
```

### .reloadStaticPage(page, callback)

Reload a static page in the servelet cache. This is useful with a GET request to reload one or more static pages that have been altered on the server.
 - page {string|string[]} : An optional page name or array of page names
 - callback {Function(Error|null)} : The callback function for error or completion

```js
servelet.reloadStaticPage(callback); // Reloads all static pages
servelet.reloadStaticPage('index', callback);
servelet.reloadStaticPage(['index', 'nav'], callback);
```

### Dynamic Page Data Methods

These methods are available on the data object that is sent into the dynamic pages.

### .include(page, newData)

Include a partial file.
 - page {string} : The name of the partial file to include
 - newData {Object=} : An optional object with new data for the include page

```js
// home.js
module.exports = (data) => `
<p>Include a partial file: ${data.include('message', { name: 'Bob' })}</p>
`;
```

### .layout(page, html)

Include a layout file for the current dynamic page.
 - page {string} : The layout name with the property name seprated by a colon
 - html {string} : The html template literal that will be injected into the layout

```js
// index.js
// Exports a function that returns the result of the layout method call
module.exports = (data) => data.layout('layout:main', `
<p>This is the main portion for the layout file.</p>
`;

----------

// layout.js
// Uses the main property from the index.js file, and includes a partial
module.exports = (data) => `
<body>
  ${data.main}
  ${data.include('article')}
</body>
`;
```

## License

[MIT](https://github.com/AdventCoding/servelet/blob/master/LICENSE)
