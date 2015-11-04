![](http://www.simplicitesoftware.com/logos/logo250.png)
---

Simplicit&eacute;&reg; monitoring
=================================

Introduction
------------

This is a simple monitoring app for the [Simplicit&eacute;&reg; platform](http://www.simplicitesoftware.com)
using the [Simplicit&eacute;&reg; API for node.js&reg;](https://www.npmjs.com/package/simplicite).

**This is still a __ALPHA__ stage app, use at your own risks**

Prerequisites
-------------

Create a `monitoring` table in the MySQL database:

```sql
create table monitoring (name varchar(100), date datetime, data longtext);
``` 

Usage
-----

To run it you need to install (or upgrade) the required packages and their dependencies:

	npm install simplicite express jade mysql

Then you can run the application by:

	node app.js

The base URL to point to is then: `http://localhost:3000`

License
-------

Copyright Simplicit&eacute; Software

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
