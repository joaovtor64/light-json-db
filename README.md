# light-json-db
Simple and small asynchronous json database for simple needs

Supports Folders and files containing JSON, names of any character set and any size - automatically parses and stringifies data

Works on Microsoft Windows and Linux distros
(OSX has not been tested yet)

# Additions

[v1.3.2]:`dir` function critical bug fix

## v1.3.0
Cache now supports folders!
(And files inside of folders that don't exist in disk *yet*)
this fixed quite a lot of bugs

It is no longer possible to `get` a directory




## v1.2.1
Files and folders can be diferenciated - the `keys` function now returns an object like this
```json
{
	"myFile":{"type":"data"},
	"myOtherFile":{"type":"data"},
	"myFolder":{"type":"folder"}
	
}
```
`data` and `folder` are the only types for database entries currently.

# Setup
```bash
npm i light-json-db
```

# Example
```js
const Database = require("light-json-db")




//Note: if you don't have a database folder you can set it up in an empty one 



(async ()=>{

	//This can be both /path/to/a/database/folder/ or
	//					 /path/to/a/database/folder
	//Altough it can't be /path/to/a/database/folder//

const db = new Database( "/path/to/a/database/folder"/*,{writeDelay:60000}*/)
//Makes database use the "/path/to/a/database/folder" path

//And will keep files written to or read in memory for 60 seconds
//(By default)
//

await db.set(["foo"],"bar");//Writes "bar" to file named "foo" in the database root

console.log(await db.get(["foo"]));
//bar (from cache)


await db.dir(["myDir"]);//Creates directory named myDir
await db.set(["myDir","fileInsideDir"],"baz"); //Creates "fileInsideDir" inside of it
console.log(await db.keys(["myDir"]));//Logs all files inside myDir
//{"fileInsideDir":{type:"data"}}

await db.remove(["foo"]);//Removes the foo file created at the start
await db.remove(["myDir"]);//Removes the myDir folder created above (and all files inside it)




//Paths are not separated by slashes (/), they are represented using Arrays of strings
//ie
// (db)/path/to/file is ["path","to","file"]


//Every directory can have as many characters as it needs and can use any characters Supported by JSON

//If you give db.set() an object value
//It will return the object when read()
//(it will parse and stringify it automatically)




})()
```


## How it works
	When you input any key as an array, it converts each element 
	into its sha and separates them with `/`s.

	Then, if you are creating a file, it adds that to a queue (sort of) and 
	the file will eventually be written to. (with v1.2 that applies to folders as well)

	and thats it. since it uses sha256 before writing, any filename of any length is 
	accepted

***


 * Todo: 
 [] Module to recover folder if `index.json` doesn't exist
 


