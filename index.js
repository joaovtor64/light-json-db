const {
	sha256
} = require("js-sha256")
const fs = require("fs/promises");

DEFAULT_CACHE_TIME = 1000;


class DataManager {
	/**
	 * 
	 * @param  {any} data (can be object or anything)
	 * @returns 
	 */
	static encode(data) {
		if (typeof data === "string" || typeof data === "number") {
			return data;
		} else {
			return JSON.stringify(data);
		}
	}
	/**
	 * 
	 * @param {String} data 
	 * @returns 
	 */
	static decode(data) {
		try {
			let o = JSON.parse(data)
			if (o && typeof o === "object") {
				return o;
			}
		} catch (e) {
			return data;
		}
	}
	static PathEncode(path) {
		let rpath = "";
		for (let i = 0; i < path.length; i++) {
			rpath += sha256(path[i]) + "/"

		}
		return rpath
	}
}

class CachedFile {

	_rawDatabaseParent;
	dir = "";
	data = "";
	timeCached = 0;
	/**
	 * @param {import("fs").PathLike} dir 
	 * @param {Number} timeCached
	 * @param {function onRemove(){}} onRemove
	 * 
	 */
	static async read(dir, timeCached, onRemove) {
		return new CachedFile(
			dir,
			await fs.readFile(dir, "utf-8"),
			timeCached,
			onRemove);


	}
	static async ref(dir, timeCached, onRemove) {
		return new CachedFile(
			dir,
			"",
			timeCached,
			onRemove

		)
	}
	write(data) {
		this.data = data;
		if (this._cacheTimeout) {
			clearTimeout(this._cacheTimeout);
		}
		this._cacheTimeout = setTimeout(() => {
			this.uncache();
		}, this.timeCached)


	}
	onRemove() {

	}
	async uncache() {
		if (!this._deleted) {
			await fs.writeFile(this.dir, this.data, "utf-8");
		} else {

			await fs.rm(this.dir);
		}
		this.onRemove();
		delete this

	}
	/**
	 * @param {import("fs").PathLike} dir 
	 * @param {String} data
	 * @param {Number} timeCached
	 * @param {function onRemove(){}} onRemove
	 * 
	 */
	constructor(dir, data, timeCached, onRemove) {
		this.dir = dir;
		if (timeCached) {
			this.timeCached = timeCached;
		}
		if (onRemove) {
			this.onRemove = onRemove;
		}

		this.write(data);



	}
	remove() {
		this._deleted = true;
	}
	_cacheInterval = null;
	_deleted = false;

}

class RawDatabase {
	files = {};
	static _onRemoveCachedFile() {

		try {
			delete this._rawDatabaseParent.files[this.dir]
		} catch (e) {
			console.error("SOMETHING HAS GONE TERRIBLY WRONG - PLEASE REPORT A BUG")
		}

	}
	/**
	 * Maps key to val
	 * THIS WILL SAVE IT AT THE DIRECTORY NAMED BY KEY, BE CAREFUL
	 * @param {String} key 
	 * @param {String} val 
	 */
	set(key, val) {
		if (this.files[key]) {
			this.files[key].write(val);
		} else {
			this.files[key] = new CachedFile(key, val, DEFAULT_CACHE_TIME, RawDatabase._onRemoveCachedFile);
			this.files[key]._rawDatabaseParent = this;

		}

	}
	/**
	 * 
	 * @param {String} key 
	 * @returns value at key (directory)
	 */
	async get(key) {
		if (this.files[key]) {
			return await this.files[key].data;
		} else {
			this.files[key] = await CachedFile.read(key, DEFAULT_CACHE_TIME, RawDatabase._onRemoveCachedFile)
			this.files[key]._rawDatabaseParent = this;
			return this.files[key].data
		}
	}

	async remove(key) {
		if (!this.files[key]) {
			await this.get(key);

		}

		this.files[key].remove();



	}
}



class Database {
	rdb = new RawDatabase();
	location = "./"
	/**
	 * 
	 * @param {Stirng} location 
	 */
	constructor(location) {
		if (location) {
			if (location.endsWith("/")) {
				this.location = location;
			} else {
				this.location = location + "/";
			}

		} else {
			console.warn("WARNING: NO LOCATION - CURRENT WILL BE USED")
		}
	}

	//Path is an Array
	//Every new file must create a ls.json (or similar) that contains info on what files are in that directory
	//All files are named after their SHAs

	async set(apath, val) {
		//DIRECTORY LOCATION
		let path = this.location + "/";

		const filesha = sha256(apath[apath.length - 1]);
		for (let i = 0; i < apath.length - 1; i++) {
			path += sha256(apath[i]) + "/"

		}

		await fs.mkdir(path, {
			recursive: true
		});
		let cTree = await fs.readdir(path);
		const filePath = path + filesha;


		const cacheFiles = Object.keys(this.rdb.files)

		if (!cTree.includes("index.json") && (!cacheFiles.includes(path + "index.json"))) {
			this.rdb.set(path + "index.json", '["' + apath[apath.length - 1] + '"]')



		} else if (!cTree.includes(filesha) && (!cacheFiles.includes(filePath))) {
			let ls;
			try {
				ls = JSON.parse(await this.rdb.get(path + "index.json"))
			} catch (e) {
				console.log("DATABASE FAIL: index.json at")
				console.log(path)
				console.log("HAD WRONG JSON DATA - KEYS WILL RESET TO []")
				//Pretty sure this will never ever ever ever ever ever ever ever ever happen but...
				ls = [];
			}
			ls.push(apath[apath.length - 1]);
			this.rdb.set(path + "index.json", JSON.stringify(ls))
			console.log(Object.keys(this.rdb.files))
		}
		this.rdb.set(filePath, DataManager.encode(val))





	}
	async get(apath) {





		let path = this.location + DataManager.PathEncode(apath);




		let data;
		try {
			data = await this.rdb.get(path)
		} catch (e) {
			console.error(e);
			return undefined
		} finally {

			return DataManager.decode(data)
		}


	}
	/**
	 * Remove a file and delete it (after the cache time)
	 * @param {Array} apath 
	 */
	async remove(apath) {


		let ls = this.location + "/";
		let lsc = [];
		for (let i = 0; i < apath.length - 1; i++) {
			ls += sha256(apath[i]) + "/"

		}
		ls += "index.json"
		lsc = JSON.parse(await fs.readFile(ls, "utf-8"));
		lsc.splice(lsc.indexOf(apath[apath.length - 1]), 1);
		this.rdb.set(ls, JSON.stringify(lsc))

		this.rdb.remove(this.location + DataManager.PathEncode(apath))
	}

	/**
	 * Returns a list of files at a certain directory
	 * @param {Array} apath 
	 */
	async keys(apath) {
		return DataManager.decode(await this.rdb.get(this.location + DataManager.PathEncode(apath) + "index.json"));

	}
}




module.exports = Database