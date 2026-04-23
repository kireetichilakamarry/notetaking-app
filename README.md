# Overview

This app combines ideas from graph search algorithms, Cornell Notes, and Obsidian into one consolidated, file-over-app note-taking system. 

Like Cornell Notes, a page contains two columns: one for **questions** and one for **answers**. However, unlike Cornell Notes, there is no summary (at least, in the current iteration). And unlike Cornell Notes, we reference questions by number, which gives us the liberty of being able to answer a question at any stage of our note-taking process. The left-hand side is essentially a queue for questions, kind of like a queue you would use to implement a search algorithm. 

Like Obsidian, this application follows a file-over-app philosophy (see this [post](https://x.com/kepano/status/1675626836821409792?s=20) for more details). This allows you to edit across multiple such applications and integrate with CLIs such as Claude Code.

# Future Ideas

1. Tab-Based Indentation
2. Dynamic Updating of Bullet Numbering, 
3. Folder Support 
4. Search support across all notes
5. A way to signal that a question has been answered (e.g., strikethrough or a check box)