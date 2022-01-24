const Database = require("./index");
const db = new Database(process.cwd() + "/dbtest", {
    writeDelay: 200
    //You can set a very high number on production
    //Although very low when testing
});
(async () => {


    await db.set(["File1"], "This is file 1")
    await db.set(["File2"], "This is file 2")
    await db.set(["File3"], "This is file 3")

    await db.dir(["Folder1"])
    await db.dir(["Folder2"])
    await db.dir(["Folder2", "FolderInsideFolder2"])
    await db.set(["Folder2", "FolderInsideFolder2", "File inside many folders"], "Third file")
    //The files aren't in disk yet 
    //But can still be listed
    console.log(await db.keys([]))
    if (!(JSON.stringify(await db.keys([])) == '{"File1":{"type":"data"},"File2":{"type":"data"},"File3":{"type":"data"},"Folder1":{"type":"folder"},"Folder2":{"type":"folder"}}')) {
        throw "Something didn't go very well here"
    }

    //Same thing here
    console.log(await db.get(["Folder2", "FolderInsideFolder2", "File inside many folders"]))
    if (await db.get(["Folder2", "FolderInsideFolder2", "File inside many folders"]) !== "Third file") {
        throw "Something didn't go very well here"
    }

    await db.remove(["Folder1"])
    //Write everything to disk
    await db.quit()

    console.log("Test passed!")
    process.exit(0)


})()