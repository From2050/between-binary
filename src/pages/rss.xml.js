import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
	const posts = await getCollection('thoughts');
	return rss({
		title: 'Between Binary',
		description: 'A digital garden for cultivating immersive tech — VR experiments, embedded systems, and notes on human-centered design.',
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/thoughts/${post.slug}/`,
		})),
	});
}
