# ComfyUI_Slider_Sidebar
## What is this?
A custom node that adds a UI element to the sidebar allowing easy access, navigation, and use of a massive collection (100+) of LECO (Slider) LoRAs. LECOs are an amazing tool to generate variance in your output with a minimal impact to consistency, i.e. deviating form your prompt. They can also allow you access to control parts of your image without taking up CLIP space, saving your token weights for more valuable keywords. If you haven't used them, there's never been a better time to try!

[Demo](https://github.com/user-attachments/assets/f87c365e-7417-4f8f-85b9-675bb66ede0c)

## Features
- Sidebar that holds all available sliders from this node's database, already over 100!
  - Right now contains almost all released Flux and Pony LECOs as of 09/17/24  
- Auto detects sliders already in your workflow and on your system.
- "Smart Wiring" lets you drag and drop sliders onto your canvas and start using them right away!
- Use sliders worry free, all of them are configured according to author guidelines!
  - Every chkpt is different, so these settings won't be perfect for everyone, but these are also changable in settings
- Click the (i) button for instant previews and help on any slider you're not sure about.
- Download any slider you're missing right from the sidebar.
- List missing a slider you have or you make custom ones? No problem! Easily add any LECO to the list via a button.
- Super fast search / filter to find the sliders you want, and favorite the ones you like!
- Use LECOs as "wildcards"! Throw in some sliders, hit randomize and have fun.
- Have a favorite author you collect LECOs from? Want to compare similar LECOs? Never been easier!
- Heaps of options that allow you to control what's displayed and how sliders function.
- Protective Goggles - NSFW content is hidden by default, your wholesome workflows are safe.

## Updates
- Re-organized some categories, improved the slider download flow to use toasts.

## Installation
### Registry - Coming Soon(tm)
### Manager
- Install it via the ComfyUI Manager (search for Slider Sidebar)
- Make sure to enable the new menu in the ComfyUI settings
- After install you probably want to go into Slider Sidebar Settings and configure things to your liking. Note the Civit API key is not required but without it your download experience will be hit and miss.
### Manual
- `git clone` this repo into your ComfyUI custom nodes folder
  - There are no python dependencies for this node since it's front end only, you can also just download and extract the node there and I won't tell.
- Make sure to enable the new menu in the ComfyUI settings
- After install you probably want to go into Slider Sidebar Settings and configure things to your liking. Note the Civit API key is not required but without it your download experience will be hit and miss.

**NOTE** - Other than small improvements most changes will be made to the data files. This should have minimal impact but as we refine categories some things might shift around.

## Usage

<img align="right" src="https://github.com/user-attachments/assets/e2d84afd-6732-4170-8423-84c48f51f47f" height=500>

- Open the sidebar and use it to control any/all sliders in your workflow, or add new ones to it
- Slider values and defaults are set according to author guidelines for min/max
- Easily bypass any slider via its tickbox
- Search / Filter the slider list super easy via the search box
- Drag and drop new sliders onto your WF and watch them automagically wire themselves if it's not the first one. (This is limited to LoraLoaderModelOnly for now)
- Rename Categories and Sliders by double clicking on the title, drag and drop category ordering.
  - Recommended to collapse categories during drag and drop to make things easier
- Download new sliders right from the sidebar in seconds
  - A Civitai API key is required to download some files
- Get quick previews and help hints from the info (i) button
- Add any LECO to the list using the Add Slider button


### Currently Supported (by default) Sliders
- "Almost All" Sliders for both Flux and Pony
  - There are many SDXL LECOs that work for Pony but I only have a few of those
- You are more than welcome to make PRs against the slider data files to add more native support 😁
  - There's at least one example entry in each dataset for you to use as reference when adding new sliders, just don't break the JSON


## Settings
This plugin has a farily massive amount of settings for you to customize the experience to fit your needs / desires. I **STRONGLY** recommend you spend a quick 5 minutes in the settings to tweak things how you want. By default the project in GitHub will show all sliders from all base models (except NSFW ones) which will probably overwhelm new users. You can easily change this in settings along with a ton of other things. Most should be self explainatory but I'll touch on a few that aren't.

- Slider Increment - Changes the amount the sliders change the model str each "tick" if you like more granular control something like .05 or .10 is good
- Civitai API Key - If you want to download all slider files you'll need a Civitai API key. You can [get one easily (and for free) from your account page](https://developer.civitai.com/docs/getting-started/setup-profile)
- Ignore Set Slider Limits - I've used the author's recommend min/max for the slider settings. If you don't want me telling you how to live your life you can enable this option and it will set the min/max for all sliders to -20/20 which should be more than enough to ruin any image you're trying to generate 😛
- 'Fix' Reverse Sliders - There's a lot of reverse slider fans, but they can be annoying to use if you don't know they're reversed. The sidebar auto tags reversed sliders by defauly, but you can use this option to turn them into regular sliders so right is "up" and left is "down" note this doesn't change anything but the slider controls on the sidebar, it's not messing with the LECO at all (and that's a GOOD thing)
- Hide Sliders Missing Model Files - Enable this option if you don't want the sidebar to show you all the sliders that exist that you don't currently have installed

![image](https://github.com/user-attachments/assets/5cd45f34-9d50-4375-8ae5-1883b43ac73d)


## Limitations
- The "Smart Wiring" doesn't kick in unless you have at least one LoraLoadModelOnly node in your workflow already. This is partially by design to keep things clean. I can expand this feature out if there are requests, but the idea is the first one you wire into your WF as desired, and then all the ones afterwards will be smart enough to do it for you
- It doesn't handle Early Access files from Civit super gracefully, the download will just fail (as it should) if you haven't put in your Civit API key and paid the piper
- The auto download and info buttons don't work well on Civitai models that use versions to define different LORAs (please don't do this)
- When downloading new sliders it will dump them into the default comfyui loras directory
- It doesn't have all sliders in the dataset

## Requirements
- This is a front end plugn so you must use the new menu for to work, you can enable it in the ComfyUI settings here (Top or Bottom doesn't matter)

![image](https://github.com/user-attachments/assets/4dcbb5f2-8a68-4ef8-8759-084a8d5af7ab)

- ComfyUI 0.1.3+
- There's no additional python requirements since it's just a frontend UI.

## Roadmap
- [ ] Graceful early access handling on doanloads
- [ ] Whatever bugs you find / features you submit

## Why
![image](https://images.squarespace-cdn.com/content/v1/5ed58282bff5e30120ba4324/1630538079275-O1TEJ639EXQRH4VCO1E6/why-not-sure-why-not.gif)

Quite frankly LECO are extremely useful tools when it comes to maintaining image composition or helping to save tokens, and I don't think they're used enough or even understood in most cases. My hope is that by making them way easier to access and use with this sidebar they get some of the recognition and adoption they deserve, especially in the Comfy community. I think that with the release of Flux we might see some great LECOs built specifically for expressions, which I'm looking forward to! I also learned a lot making my [Prompt Gallery](https://github.com/Kinglord/ComfyUI_Prompt_Gallery) plugin and wanted to see if I could push things a bit more.

## Credits
**Slider (LECO) Creators**

This plugin wouldn't be useful at all without all the content put out by the community. You're all great, but a few standouts that I wanted to call out are:

- [Ai Art Vision](https://civitai.com/user/Ai_Art_Vision)
- [Goofy AI](https://civitai.com/user/Goofy_Ai)
- [Kojimbomber](https://civitai.com/user/Kojimbomber)
- [ntc](https://civitai.com/user/ntc)
- [Shed_The_Skin](https://civitai.com/user/Shed_The_Skin)
- [Topplok2](https://civitai.com/user/Topplok2)
- (If you want your name added to the list just let me know!)


**Comfy Org (Duh)**
- Special shoutout to Joviex for early plugin feedback
  
https://github.com/comfyanonymous/ComfyUI

https://www.comfy.org/discord

### Compatability
Tested on ComfyUI 0.2.0
Should work on any version 0.1.3+
