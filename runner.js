var fetch = require("node-fetch");
var puppeteer = require("puppeteer");
var expandSpaces = require("./helper").expandSpaces;
require("dotenv").config();

async function logInFromLandingPage(browser, page, username, password) {
	await page.waitForSelector(".m-login");

	const createNewPagePromise = () => {
		const newPagePromise = new Promise((x) =>
			browser.once("targetcreated", (target) => {
				console.log("target was created and detected!");
				return x(target.page());
			})
		);

		return newPagePromise;
	};

	await page.click("a.m-login");

	let newPage = await createNewPagePromise();

	console.log("title is: " + newPage.title());

	await newPage.waitForSelector("input[name=username]");
	await newPage.type("input[name=username]", username);
	await newPage.type("input[name=password]", password);
	await newPage.click("button[type=submit]");

	await page.reload({ waitUntil: "domcontentloaded" });
}

async function createNewPost(page, title, body) {
	await page.waitForSelector("textarea.m-input-title");
	await page.click("textarea.m-input-title");
	await page.type("textarea.m-input-title", title);

	await page.waitForSelector("textarea.m-input-body");
	await page.type("textarea.m-input-body", body);

	await page.click(
		"#post-2 > div > p > div > div.m-wrap > div.m-page > div.m-form.m-create.m-focused > div.m-controls > button"
	);
}

var loginAndPost = async function (account, post) {
	var browser;

	try {
		browser = await puppeteer.launch({ headless: true });
		var page = await browser.newPage();
		page.setDefaultNavigationTimeout(60000);

		await page.goto("https://forums.housing.ubc.ca/");

		await logInFromLandingPage(
			browser,
			page,
			account.username,
			account.password
		);

		var maxCharsGivenByMuut = 80;
		var remainingCharsAfterTitle = maxCharsGivenByMuut - post.title.length;
		var spacesToAddBeforeExceedingLimit =
			post.nextTimesSent % (remainingCharsAfterTitle + 1);

		// the reason why we expand spaces is so that each title will be unique but still be displayed the same (muut won't accept duplicate title)
		await createNewPost(
			page,
			expandSpaces(post.title, spacesToAddBeforeExceedingLimit + 1),
			post.body
		);

		await browser.close();
	} catch (err) {
		console.log("this error happened: " + err["message"]);
		await browser.close();
		await loginAndPost(account, post);
	}
};

var runUpdates = async function () {
	var response;

	var getRawFuturePostsToBeUpdated = async function () {
		try {
			return await fetch(
				process.env.FORUM_BOT_BACKEND +
					"/api/future-posts-to-be-updated"
			);
		} catch (err) {
			console.log("failed to fetch fututre posts and retrying");
			return await getRawFuturePostsToBeUpdated();
		}
	};

	response = await getRawFuturePostsToBeUpdated();

	var accountAndPosts = await response.json();

	if (accountAndPosts["error"]) {
		return console.log(accountAndPosts["error"]["message"]);
	}

	for (const accountAndPost of accountAndPosts) {
		var account = accountAndPost["account"];
		var post = accountAndPost["post"];
		await loginAndPost(account, post);

		var getRawUpdateResponse = async function () {
			try {
				return await fetch(
					process.env.FORUM_BOT_BACKEND +
						"/api/future-posts/" +
						post["_id"],
					{
						method: "POST",
					}
				);
			} catch (err) {
				console.log(
					"failed to udate fututre post " +
						post["_id"] +
						" and retrying."
				);

				return await getRawUpdateResponse();
			}
		};

		await getRawUpdateResponse();
	}
};

runUpdates();
setInterval(runUpdates, 60 * 60 * 1000);
