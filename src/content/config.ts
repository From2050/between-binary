import { defineCollection, z } from 'astro:content';

const thoughts = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.date(),
        updatedDate: z.date().optional(),
        heroImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
});

const lab = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.date(),
        status: z.enum(['prototype', 'beta', 'release', 'concept']),
        stack: z.array(z.string()).optional(),
        repoUrl: z.string().optional(),
        heroImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
});

const garden = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        updatedDate: z.date(),
        stage: z.enum(['seedling', 'budding', 'evergreen']),
        tags: z.array(z.string()).optional(),
    }),
});

export const collections = { thoughts, lab, garden };
