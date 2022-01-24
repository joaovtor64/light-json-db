sfs = require("fs");




const {
	createHash
} = require("crypto")
const fs = require("fs/promises");




let CACHE_TIME = 1000;

function sha256(input) {
	return createHash("sha256").update(input).digest('hex')
}



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
	static PathEncode(path, file) {
		let rpath = "";
		if (file) {
			for (let i = 0; i < path.length - 1; i++) {
				rpath += sha256(path[i]) + "/"

			}
			rpath += sha256(path[path.length - 1])
		} else {
			for (let i = 0; i < path.length; i++) {
				rpath += sha256(path[i]) + "/"

			}

		}
		return rpath
	}
	static GetIndexContaining(key, location) {
		key = Array.from(key);
		key.pop();
		let ls = location + DataManager.PathEncode(key)

		ls += "index.json"
		return ls
	}
}
//RawDatabase Entry
class Entry {
	/**
	 * @type {("data"|"folder")}
	 */
	type = "";
	/**
	 * @type {import("fs").PathLike}
	 */
	location = "";
	/**
	 * @type {?String} 
	 */
	value = {};
	/**
	 * @type {Boolean}
	 */
	toDelete = false
	/**
	 * @type {?Boolean}
	 */
	important = false;

	constructor(type, location, toDelete, value, important) {
		this.type = type;
		this.location = location;
		this.toDelete = toDelete;
		this.value = value;
	}
}
class Cache {
	/**
	 * @type {Object.<import('fs').PathLike,Entry>}
	 */
	static entries = {

	}
	static queue = []
	static genQueue() {
		let tw = Object.keys(this.entries)
		Cache.queue = []
		let i;
		//Important queue
		let iq = [];


		/**
		 * When generating queue, the deepest items should be placed last
		 * So that no "Directory doesn't exist" error happens
		 * (And this code does that)
		 * 
		 * 1) Folders (Deepest last)
		 * 2) Files (The folders are already created so no problem here)
		 */

		for (i of tw) {
			if (this.entries[i].important) {
				iq.push(this.entries[i])
			}
		}

		iq.sort((a, b) => (a.location.length - b.location.length))


		for (i of tw) {
			if (!this.entries[i].important) {
				Cache.queue.push(this.entries[i])
			}
		}
		Cache.queue = iq.concat(Cache.queue)
	}
	static async consume() {
		//to write
		let tw = Cache.queue;
		//The first Entry
		/**
		 * @type {Entry}
		 */
		let e = tw[0]


		if (tw.length > 0) {
			if (e.toDelete) {
				try {
					await fs.rm(tw[0].location, {
						recursive: true
					});
				} catch (error) {
					if (error.errno === -2) {
						console.error("Attempted to remove file or folder that doesn't exist")
					}
				}
				delete Cache.entries[tw[0].location];
				Cache.genQueue()
				return
			} else {
				if (e.type == "data") {

					try {
						await fs.writeFile(tw[0].location, e.value);
					} catch (error) {

						console.error(error)
					}
					delete Cache.entries[tw[0].location];
					Cache.genQueue()
					//(Folder)
				} else {
					try {
						await fs.mkdir(tw[0].location, {
							recursive: false
						});
					} catch (e) {
						if (e.errno === -17) {
							console.error("File or folder already exists with that name")
						}
					}
					delete Cache.entries[tw[0].location]
					Cache.genQueue()


				}
			}
		}
	}
}

class RawDatabase {


	/**
	 * 
	 * THIS WILL SAVE IT AT THE DIRECTORY NAMED BY KEY, BE CAREFUL
	 * @param {String} key 
	 * @param {String} val 
	 * 
	 */
	set(key, val) {
		Cache.entries[key] = new Entry("data", key, false, val, false);
		Cache.genQueue()

	}
	/**
	 * 
	 * @param {String} key 
	 * @returns {Promise<String>} value at key (directory)
	 */
	async get(key) {
		if (Cache.entries[key]) {
			//Read from cache
			return Cache.entries[key].value;
		} else {
			//Read and put in cache
			try {
				Cache.entries[key] = new Entry("data", key, false, await fs.readFile(key, "utf-8"));
				Cache.genQueue()
			} catch (e) {

				console.error(e);
				console.error("Read operation on file that doesn't exist")
			}
			return Cache.entries[key].value;






		}
	}
	async dir(key) {
		Cache.entries[key] = new Entry("folder", key, false, {}, true);
		Cache.genQueue()
	}
	async remove(key) {
		if (Cache.entries[key]) {
			Cache.entries[key].toDelete = true;
		} else {
			Cache.entries[key] = new Entry("any", key, true, "");
			Cache.genQueue()
		}






	}
}

class Options {


	writeDelay = 60000;




}

class Database {
	rdb = new RawDatabase();
	location = "./"

	/**
	 * 
	 * @param {Stirng} location 
	 * @param {Options} options
	 */
	constructor(location, options) {
		if (location) {
			if (location.endsWith("/")) {
				this.location = location;
			} else {
				this.location = location + "/";
			}
			if (!sfs.readdirSync(location).includes("index.json")) {
				sfs.writeFileSync(location + "/index.json", "{}");
				console.log("index.json created at database")
			}
		} else {

			throw "new Database() requires a location for the database"

		}
		if (options) {
			if (options.writeDelay) {
				CACHE_TIME = options.writeDelay;
			}
		}
		setInterval(async function () {
			await Cache.consume()
		}, CACHE_TIME)


	}

	//Path is an Array
	//Every new file must create a ls.json (or similar) that contains info on what files are in that directory
	//All files are named after their SHAs

	async set(key, val) {
		//DIRECTORY LOCATION
		let filePath = this.location + DataManager.PathEncode(key, true);

		let ls = DataManager.GetIndexContaining(key, this.location);
		let lsc = JSON.parse(await this.rdb.get(ls))
		if (!lsc[key[key.length - 1]]) {

			lsc[key[key.length - 1]] = {
				type: "data"
			}

			this.rdb.set(ls, JSON.stringify(lsc));
		}



		this.rdb.set(filePath, DataManager.encode({
				content: val,
				name: key[key.length - 1],
				lastModified: Date.now()
			}

		))






	}
	/**
	 * 
	 * @param {Array.<String>} key 
	 * @returns {Promise<*>}
	 */
	async get(key) {





		let path = this.location + DataManager.PathEncode(key, true);




		let data;


		data = DataManager.decode(await this.rdb.get(path));

		return data.content




	}
	/**
	 * Remove a file/folder and delete it (after the cache time)
	 * @param {Array.<String>} key
	 */
	async remove(key) {


		let ls = DataManager.GetIndexContaining(key, this.location);
		let lsc = JSON.parse(await fs.readFile(ls, "utf-8"));

		delete lsc[key[key.length - 1]];
		this.rdb.set(ls, JSON.stringify(lsc))

		this.rdb.remove(this.location + DataManager.PathEncode(key))
	}

	/**
	 * Returns a list of files at a certain directory
	 * @param {Array} key 
	 */
	async keys(key) {
		return (DataManager.decode(await this.rdb.get(this.location + DataManager.PathEncode(key) + "index.json")));

	}
	/**
	 * Makes key a directory 
	 * 
	 * @param {Array.<String>} key 
	 */
	async dir(key) {
		let ls = DataManager.GetIndexContaining(key, this.location);
		let lsc = JSON.parse(await this.rdb.get(ls));

		let path = this.location + DataManager.PathEncode(key)

		lsc[key[key.length - 1]] = {
			type: "folder"
		}
		this.rdb.set(ls, JSON.stringify(lsc));
		//ls inside
		let lsi = path + "index.json";

		try {

			this.rdb.dir(path)
			this.rdb.set(lsi, "{}")
		} catch (e) {
			console.error(e)
		}



	}
	/**
	 * Saves all cache to disk as quickly as possible
	 */
	async quit() {
		let i = 0
		let l = Object.keys(Cache.entries).length;
		while (i < l) {
			await Cache.consume()
			i++;
		}
		console.log(l + " Entries written to disk")

		return
	}

}




module.exports = Database