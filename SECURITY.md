# Security

## Reporting

Report a vulnerability to **hallo@laufbild.ai**. Please do not open a public
issue for anything exploitable. We reply within five working days.

## What this plugin does, and what it does not

This plugin holds no credentials and no customer data. It carries a manifest,
one skill, and two local helpers. Everything it knows about video styles it
asks the laufbild MCP server for at call time.

The free part of that server is read-only: it serves text files, reads no
database, and has no account to attach you to. Nothing you do through this
plugin is stored against your identity, because there is no identity.

## The one risk you should understand

A video is built from the text of someone else's website. Your model writes
HTML, CSS and JavaScript from that text, and that markup then runs in a
browser **on your machine** in order to be rendered.

On the laufbild servers the same step runs inside a gVisor container with no
network. On your machine there is no such container.

That is why `lib/sanitize.mjs` exists and why the build rules tell you to run
it before every render: no network, no external addresses, no event
attributes, ASCII only. Render only what comes out of it.

If you render generated markup without sanitizing it first, you are running
code derived from an untrusted website on your own computer. The sanitizer is
in this repository, openly, so you can read exactly what it removes.
