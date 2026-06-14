---
title: 'Rethinking Rate Limits and Retries in AI-Powered Obsidian Plugins: Why Pushing Through Isn’t Always the Answer'
slug: 'rethinking-rate-limits-retries-ai-obsidian-plugins'
date: '2026-06-14'
category: 'Engineering'
tags: ['ai', 'obsidian', 'rate-limits', 'retries', 'plugin-development']
excerpt: 'Challenging the assumption that aggressive retrying on rate limits improves AI plugin reliability in Obsidian, exploring smarter alternatives for better user experience.'
image: '/blog/images/rethinking-rate-limits-retries-ai-obsidian-plugins.png'
---

# Rethinking Rate Limits and Retries in AI-Powered Obsidian Plugins: Why Pushing Through Isn’t Always the Answer

## Introduction: The Common Assumption About Rate Limits and Retries

Most developers building AI-powered Obsidian plugins treat rate limits as a temporary hurdle to overcome with aggressive retries. The logic seems straightforward: if an AI API call gets rate-limited, just wait a bit and try again, maybe multiple times, until it succeeds. This approach promises reliability through persistence, ensuring the user eventually gets the AI response they requested.

But is this really the best approach? In this post, I’m going to challenge this assumption by exploring why hammering AI APIs with retries can backfire — both technically and from a user experience perspective — and suggest alternative strategies that respect rate limits while improving your plugin’s resilience and usability.

## Why Aggressive Retries Can Hurt More Than Help

### 1. Increased Latency and User Frustration

When your plugin continuously retries after rate limits, users often experience long, unpredictable delays. They may see loading spinners that last much longer than expected or even indefinite waiting if the retry logic lacks proper backoff or timeout.

This waiting time is more than just inconvenient; it breaks the sense of flow and trust in the tool. Users want rapid feedback, especially in workflows like note-taking where interruptions can kill productivity.

### 2. Amplified Rate Limit Problems

Ironically, aggressive retries can worsen rate limit issues. Many AI providers use dynamic rate limits based on server load or user behavior. When many clients retry simultaneously, they can create a retry storm that overloads the API and triggers stricter rate limiting.

This cascading effect can lead to prolonged outages or throttling, affecting all users of your plugin or even the AI service.

### 3. Wasted API Usage and Cost

Retries can mean repeated API calls that ultimately get discarded or ignored because of exceeding limits or timeouts. This can inflate costs if you pay per request or token usage, and it burdens the API provider’s infrastructure unnecessarily.

## Shifting the Paradigm: Alternatives to Aggressive Retry

Instead of brute force retrying, consider smarter, user-centric strategies that handle rate limits gracefully and keep users informed.

### Backoff and Jitter

If you do retry, implement exponential backoff combined with jitter — randomizing retry intervals to avoid synchronized retry storms. This reduces pressure on the API and improves the chance of success without overwhelming the system.

### Rate Limit Awareness and User Feedback

Build your plugin to detect rate limit responses explicitly and communicate this clearly to users. Instead of hiding the problem behind silent retries, show a message like "We're hitting API limits right now. Retrying soon..." or suggest the user tries again later.

Transparency goes a long way in managing expectations.

### Request Throttling and Queueing

Introduce client-side throttling that limits how many AI requests your plugin sends in a given time frame. Queue requests and process them gradually rather than firing all at once.

For example, if a user is batch-processing notes, your plugin might send only one request every few seconds rather than firing them all simultaneously.

### Cache and Reuse Responses

Where possible, cache AI responses for repeated queries or similar contexts. This avoids unnecessary API calls and reduces the chance of hitting rate limits.

### Prioritize Important Requests

Not all AI queries are equally urgent. Design your plugin to prioritize critical interactions, like real-time help or essential note generation, while deferring or batching less important requests.

## A Real-World Example: AI Summarization Workflow

Imagine a user working through a large vault of notes, asking the AI to summarize each note. A naive plugin might send all these summarization requests one after another as fast as possible. If the AI provider has a rate limit of 60 requests per minute, this will almost certainly cause a flood of rate limit errors.

A better approach:

- The plugin implements a queue that releases one summarization request every 2 seconds.
- If a rate limit error is returned, the plugin pauses the queue for 30 seconds and informs the user.
- Responses are cached so if the user revisits a note, the summary is reused.
- The user sees a progress bar and status updates, so they understand why processing takes time.

This strategy balances API limits with user expectations and prevents aggressive retries that would only cause more rate limits.

## Checklist for Handling Rate Limits in AI-Powered Plugins

- [ ] Detect rate limit responses explicitly and handle them separately.
- [ ] Implement exponential backoff with jitter to space out retries.
- [ ] Provide clear user feedback about rate limits and retry status.
- [ ] Throttle requests client-side to avoid bursts.
- [ ] Cache AI responses to reduce repeat calls.
- [ ] Prioritize and batch requests based on urgency.
- [ ] Design workflows to gracefully pause and resume when limits are hit.

## Conclusion: Respecting Limits Enhances Reliability

The reflex to retry aggressively after hitting rate limits is understandable but ultimately counterproductive. Instead, treating rate limits as signals to slow down, queue intelligently, and communicate clearly with users creates a more reliable and user-friendly AI experience in Obsidian plugins.

By challenging this common assumption, developers can build smarter plugins that work better within API constraints and deliver a smoother knowledge management experience.

If you want to bring this workflow into Obsidian, Note Companion is one option to explore.
