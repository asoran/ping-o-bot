import * as pup from 'puppeteer';

import { signUrl } from './conf.json';
import { DMChannel } from 'discord.js';

export async function sign(username: string, password: string, channel: DMChannel): Promise<string | null> {
	const browser = await pup.launch({
		headless: true,
		args: ['--no-sandbox'],
	});
	const page = await browser.newPage();

	channel.send('Chargement ...');
	await page.goto(signUrl, {
		waitUntil: 'networkidle2',
	});

	channel.send('Accès a la page de login ...');
	await Promise.all([
		page.waitForNavigation(),
		page.$eval('#upem', e => (e as HTMLElement).click()),
	]);

	channel.send('Login en cours ...');
	await page.$eval('#fm1', (fm, uname, pass) => {
		const u = fm.querySelector('#username') as HTMLInputElement;
		if(u) {
			u.value = uname;
		}

		const p = fm.querySelector('#password') as HTMLInputElement;
		if(p) {
			p.value = pass;
		}
	}, username, password);

	await Promise.all([
		page.$eval('#fm1 input[name=submit]', fm => (fm as HTMLElement).click()),
		page.waitForNavigation({
			waitUntil: 'networkidle2',
		}),
	]);

	// Necessary to wait here :/
	await new Promise((res) => {
		setTimeout(res, 2000);
	});

	channel.send('Recherche du créneau a valider ...');
	const href = await page.evaluate(() => {
		// eslint-disable-next-line no-undef
		const a = document.body.querySelector('td.statuscol.lastcol a') as HTMLLinkElement;
		return a ? a.href : null;
	});
	if (href) {
		channel.send('Créneau trouvé!');
		await Promise.all([
			page.waitForNavigation(),
			page.goto(href),
		]);

		await page.$eval('input#id_status_681', c => (c as HTMLInputElement).checked = true);

		const filename = `proof_${username}_${Date.now()}.png`;
		await page.screenshot({
			path: filename,
		});

		await Promise.all([
			page.waitForNavigation(),
			page.$eval('input#id_submitbutton', c => (c as HTMLElement).click()),
		]);

		channel.send('Siganture réussie !');
		await browser.close();
		return filename;
	}
	else {
		channel.send('Pas de créneau disponible !');
		await browser.close();
		return null;
	}
}
