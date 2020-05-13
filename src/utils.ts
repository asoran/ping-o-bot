import { CalendarComponent, FullCalendar, parseICS, parseFile } from 'ical';
import {
	icalLocation,
} from './conf.json';

export const MS_IN_HOUR = 1000 * 60 * 60;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateToString(date: Date): string {
	return `${date.getDate()} of ${months[date.getMonth()]} at ${date.toLocaleTimeString('fr-FR')}`;
}

export function printData(events: CalendarComponent[]): void {
	events.forEach(ev => {
		if(ev.start && ev.end) {
			console.log(`[${dateToString(ev.start)}] to [${dateToString(ev.end)}] (${ev.summary})`);
		}
	});
}

export async function loadCalendar(url: string): Promise<CalendarComponent[]> {
	let cal: FullCalendar;
	try {
		const file = await (await fetch(url)).text();
		cal = parseICS(file);
	}
	catch(e) {
		cal = parseFile(icalLocation);
	}

	// Testing
	// const now = Date.now();
	// const evv = {
	// 	start: new Date(now + 5 * 1000),
	// 	end: new Date(now + 1000 * 20),
	// 	uid: 'lol',
	// } as CalendarComponent;

	// return new Array<CalendarComponent>().concat(evv).concat(
	return (
		Object.keys(cal)
			.map(e => cal[e])
			.filter(ev => ev.type === 'VEVENT' && ev.summary === 'Présence INFO2')
			.filter(ev => ev.start ? ev.start >= new Date() : false)
			// Filtre mardi
			.filter(ev => ev.start ? ev.start.getDay() != 2 : false)
	);
}

export function peopleToPingString(people: string[]): string {
	return people.map(p => `<@${p}>`).join('');
}
