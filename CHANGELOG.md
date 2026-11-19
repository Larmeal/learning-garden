# Changelog

Made from the commit messages by `npm run changelog` (from `site/`), newest day first. Do not edit it by hand: change the commit message
instead, or read the commit body for the reasons. How a message is written is in [`.cz.toml`](.cz.toml) (`type(scope): subject`).
Housekeeping (`chore`, `ci`, `test`) is not listed. The older, hand-written notes are in [`docs/changelog-handwritten.md`](docs/changelog-handwritten.md).

## 2026-11-19

### Changed

- **tools**: make the changelog from commit messages, with a commitizen config for the format ([`571e9fb`](https://github.com/Larmeal/learning-garden/commit/571e9fbc8a9ef9a026736c304c7be0f5d1144a78))

### Docs

- **readme**: explain commit messages and the generated changelog, and update the skills that told Claude to edit CHANGELOG.md ([`a3070b2`](https://github.com/Larmeal/learning-garden/commit/a3070b25a67d23c3a45526d9c83239f67104d6a9))
- move the notes written by hand to docs/ and start the generated CHANGELOG.md ([`7c99aff`](https://github.com/Larmeal/learning-garden/commit/7c99aff2ab4a7842a4c63f638f5ac11b13ec11b1))

## 2026-11-18

### Added

- **networking**: Networking subject with 14 lessons in Thai and English, 26 labs and 14 exercises ([`f87e96b`](https://github.com/Larmeal/learning-garden/commit/f87e96be1fa99b64f3c91826aad52b78f1e95931))
- App Security and Data Security subjects, shared styles, ref tool and sync hashes ([`8aa0d40`](https://github.com/Larmeal/learning-garden/commit/8aa0d40a4741d6dda98d50cd9ef585207e9db05e))

## 2026-11-17

### Added

- **git**: eleven animated labs, a lab data exercise with 63 checks, and a rewritten squash example ([`1dc39ed`](https://github.com/Larmeal/learning-garden/commit/1dc39ede5130b4974b32ccb48994b565cc7baf07))
- **site**: Ask, a dev toolbar app to highlight text on a lesson and ask the Claude of this computer, with history, rename and tool cards ([`29c16d9`](https://github.com/Larmeal/learning-garden/commit/29c16d9fad89378a94745ef40ee518a6665e4a50))

### Docs

- **data-quality**: say row and table instead of record and dataset, and make the Completeness page easier to read ([`e9e9893`](https://github.com/Larmeal/learning-garden/commit/e9e98933b214d5de9cfbfafb0623e6cf69e56c88))
- describe Ask, the Git labs and the Data Quality edits, and record translation-sync hashes ([`a961ae5`](https://github.com/Larmeal/learning-garden/commit/a961ae57298094f0cdabd11eef2e8163b90d1f50))

## 2026-11-15

### Added

- **git**: Git subject with 15 lessons in Thai and English, 6 labs, 16 exercises and a knowledge graph ([`4e1132a`](https://github.com/Larmeal/learning-garden/commit/4e1132a6388d526674ef09fe734be1dcab2eed48))

## 2026-11-14

### Added

- **spark**: rebuild SpillLab and JoinDecisionLab, add RepartitionLab, fix sideways scroll of lab boxes ([`972eaf5`](https://github.com/Larmeal/learning-garden/commit/972eaf5cf31682d18497cb89ca7d3278620dbe70))
- **spark**: Cache and Persist page, CacheLab, LineageLab, and checks that run on real Spark ([`5b08b08`](https://github.com/Larmeal/learning-garden/commit/5b08b0874301ab4e30f1b8ad5d48a64aa4593ee9))

### Docs

- **create-learning**: lab-audit checks sideways scroll at 1920px and resets option groups ([`a0c651c`](https://github.com/Larmeal/learning-garden/commit/a0c651c7e5dc8c3f53bc7f1c12b61bb93219d62d))

## 2026-11-13

### Added

- **iceberg**: exercises 01-16, helpers, docs and knowledge graph ([`7165310`](https://github.com/Larmeal/learning-garden/commit/716531074ab1f9c9a3c18f06f68b4368a61d8297))
- **site**: iceberg labs and shared ib- styles ([`16cb89d`](https://github.com/Larmeal/learning-garden/commit/16cb89de7706e42bdc4b5ea43cb10c3914b0a392))
- **site**: optional facts list on subject and lesson pages ([`bdac884`](https://github.com/Larmeal/learning-garden/commit/bdac884167f71f0677e65eebc78c09d5240e8cea))

### Fixed

- **iceberg**: use the real terms in the labs and stop the figures scrolling sideways ([`fbd99f9`](https://github.com/Larmeal/learning-garden/commit/fbd99f90a49137dbd12c0f9f4293b0761fe589ae))
- **iceberg**: draw the step 1 and 2 arrows of ReadPathLab as clean elbows into the boxes ([`d88090f`](https://github.com/Larmeal/learning-garden/commit/d88090fee3b1079b9e7abdda37633ef13639d3d5))

### Docs

- **iceberg**: add the 14 Thai lessons, quizzes and two sub-pages ([`d72bdff`](https://github.com/Larmeal/learning-garden/commit/d72bdff87c7c3772012640d61a9e4e3a1f46686c))
- **iceberg**: add the English lessons and record translation sync ([`f5632e6`](https://github.com/Larmeal/learning-garden/commit/f5632e672513a144598b10eb050c02ba8272a398))
- changelog for the Iceberg subject and the Thai wording pass ([`c63826e`](https://github.com/Larmeal/learning-garden/commit/c63826edacfb23269750661df04e285108d5afb8))
- **iceberg**: use Metadata File, Data File and Delete File in the Thai lessons ([`2b8fdc5`](https://github.com/Larmeal/learning-garden/commit/2b8fdc593dec894c8a1c235207d6bbbb6dcce818))
- changelog for the Iceberg term fix ([`c190cf5`](https://github.com/Larmeal/learning-garden/commit/c190cf57d4a15210d9da99d4dd356d37b4e7a6b2))
- **iceberg**: English topic titles, facts on every page and a shorter subject intro ([`c2fe23a`](https://github.com/Larmeal/learning-garden/commit/c2fe23aa9e3292593ecaab56bb76994146692811))
- **spark**: English topic titles and facts on every page ([`21ff98d`](https://github.com/Larmeal/learning-garden/commit/21ff98d20d5e7678434c519735825591cea2ff61))
- **great-expectations**: English topic titles and facts on every page (exercises print, they do not assert) ([`a0c0f33`](https://github.com/Larmeal/learning-garden/commit/a0c0f3323c483f81591356c9beb2af5a72ec86a9))
- **data-quality**: English topic titles and facts on every page ([`fc16f94`](https://github.com/Larmeal/learning-garden/commit/fc16f94ee54cbd608e258b3f31ace66501358aab))
- **pytest**: English topic titles and facts on every page ([`cfb80e9`](https://github.com/Larmeal/learning-garden/commit/cfb80e9547bf3152a7a6f8f2df4931ac6d3ab060))
- **pydantic**: English topic titles and facts on every page ([`73db770`](https://github.com/Larmeal/learning-garden/commit/73db7706de4fca85881edb1f699340d32a0aae52))
- **singing**: English topic titles and facts on every page, Thai and English ([`319113a`](https://github.com/Larmeal/learning-garden/commit/319113a328c3c028d6cd4fe2a2b13d5394e744e2))
- **guitar,music-theory**: English topic titles, facts on every page and the glossary titles ([`72bf11e`](https://github.com/Larmeal/learning-garden/commit/72bf11e1c415b50c985f2f8a7ddd7acb5dcdeac4))
- record translation sync and the changelog for titles and facts ([`da6b733`](https://github.com/Larmeal/learning-garden/commit/da6b733963da01804e9d155843a82cc82db8766d))
- explain how to clone and run the site and the exercises, add Iceberg setup.sh and uv.lock ([`24a7ecb`](https://github.com/Larmeal/learning-garden/commit/24a7ecb81f29ababd24db2cc44cb76c2bd0c6a11))

## 2026-11-12

### Added

- **skill**: add thaihumanize skill with the owner's Thai voice, lint, fix and syntax scripts ([`9aa5d31`](https://github.com/Larmeal/learning-garden/commit/9aa5d31bff40a71839cae42601adf042a6d43a26))

### Docs

- **data-quality**: rewrite the Thai lessons in the owner's voice ([`7edbb70`](https://github.com/Larmeal/learning-garden/commit/7edbb70fb9a3aaf06de7e0cbe2334576a1099753))
- **great-expectations**: rewrite the Thai lessons in the owner's voice ([`56cd433`](https://github.com/Larmeal/learning-garden/commit/56cd4333feb3daf4075bd0f933ebd84d2319c2e5))
- **guitar**: rewrite the Thai lessons in the owner's voice ([`ac7a642`](https://github.com/Larmeal/learning-garden/commit/ac7a64207961b6a950f6e3e43cf3f8f18871aae6))
- **music-theory**: rewrite the Thai lessons in the owner's voice ([`cbfa4c6`](https://github.com/Larmeal/learning-garden/commit/cbfa4c66cf0efab439b017e69e33d05b0b0bba19))
- **pydantic**: rewrite the Thai lessons in the owner's voice ([`5b1b6a0`](https://github.com/Larmeal/learning-garden/commit/5b1b6a06d424ecd9ea7ff12bf8322ae53f3e5462))
- **pytest**: rewrite the Thai lessons in the owner's voice ([`93a7996`](https://github.com/Larmeal/learning-garden/commit/93a79967a5bfb2f37a13d8148c739d3f8fa712c2))
- **singing**: rewrite the Thai lessons in the owner's voice ([`7dc2bc1`](https://github.com/Larmeal/learning-garden/commit/7dc2bc12a1c5c3c7676a371bf7822a855e65644b))
- **spark**: rewrite the Thai lessons in the owner's voice ([`4afb988`](https://github.com/Larmeal/learning-garden/commit/4afb9883d1417f179d89c600dec2a885b41bcc20))
- **pydantic**: align the English errors page with the corrected Thai wording ([`251e03c`](https://github.com/Larmeal/learning-garden/commit/251e03cea500b5ef82f30008cd73fd9036bd4ca3))
- **labs**: rewrite the Thai text of the labs in the owner's voice ([`25060f0`](https://github.com/Larmeal/learning-garden/commit/25060f0c42d439cad41579aea97c12c38725c7eb))
- **site**: rewrite Thai interface text and subject descriptions in the owner's voice ([`87f3ede`](https://github.com/Larmeal/learning-garden/commit/87f3edef249cfd9f6e0cd049f5a568b1fb7a601d))

## 2026-11-10

### Added

- **singing**: add the singing subject with ten lessons, voice labs and a browser voice synthesizer ([`9daf333`](https://github.com/Larmeal/learning-garden/commit/9daf33390446dccb1ee37f7eeed91f128b997015))

### Fixed

- **guitar**: call the improvisation lesson "การ Improvise" in its title, glossary and links ([`d1f1ddc`](https://github.com/Larmeal/learning-garden/commit/d1f1ddc6cc91fb54274c2d78dd558c161ea61396))

### Docs

- **data-quality**: rewrite the Dimension lesson and its eight deep-dive pages to be easier to picture ([`6e46b82`](https://github.com/Larmeal/learning-garden/commit/6e46b8258c069b8ed3b19123fb16d3b8597c5cc0))

## 2026-11-09

### Added

- **guitar**: glossary gets Fret Buzz, eight acoustic parts and "See also" links ([`c776a4d`](https://github.com/Larmeal/learning-garden/commit/c776a4d9f9f281e8bafa1ffe460e2861a0aef0ab))
- **guitar**: add an Anatomy page with an animated acoustic guitar ([`aa5f96b`](https://github.com/Larmeal/learning-garden/commit/aa5f96bcd867a982b93f5ac6034c0837591ef099))

### Docs

- note the guitar Anatomy page, the glossary changes and what was not checked ([`10261ec`](https://github.com/Larmeal/learning-garden/commit/10261ec65fd2ccf0f3d7c620c53d460c8318fbd7))

## 2026-11-08

### Added

- **site**: add a Notes app to the dev toolbar for leaving comments on parts of a page ([`b921961`](https://github.com/Larmeal/learning-garden/commit/b92196133c1a7f9770a5c0a7a2c9f17cd2d6c221))
- **site**: link every mention of another lesson, and fail the deploy when one is not a link ([`c9f1b98`](https://github.com/Larmeal/learning-garden/commit/c9f1b98db4485bc1278ec7516b6efcf3094d56e7))
- **site**: point lesson links at the heading each sentence is about, and check headings and backlinks ([`c4057a8`](https://github.com/Larmeal/learning-garden/commit/c4057a891c91069b9e08dda7ceea5ef5096db643))
- **site**: show what links to a lesson in the dev editor ([`b7364a4`](https://github.com/Larmeal/learning-garden/commit/b7364a4d95c0c400c2cc77338bc1ed883c816cb4))
- **site**: add an interactive timeline lab for the history of Spark ([`9998709`](https://github.com/Larmeal/learning-garden/commit/99987092b46b62c84adfa8f3244d49af74dfc5be))
- **spark**: add a page on what Spark is, its history and the problems it solves ([`ec0d6ed`](https://github.com/Larmeal/learning-garden/commit/ec0d6edbca342b4eddcd8e7114d6c2468ec0441b))

### Fixed

- **site**: make lesson tables readable on a phone and polish the layout of home, subject and lesson pages ([`0e6be8f`](https://github.com/Larmeal/learning-garden/commit/0e6be8f6573cc227410f281e318888e2725218f6))
- **site**: keep the header inside the screen on a phone by hiding the site name below 430px ([`9390e9e`](https://github.com/Larmeal/learning-garden/commit/9390e9e87a3e1d2ac7c0a797dd82a9b0a311a114))
- **site**: keep your place in the dev editor when opening Edit, typing and going back to View ([`809ea70`](https://github.com/Larmeal/learning-garden/commit/809ea70322eee7b91e9f8b0beec72aca25ac2d3a))

### Docs

- bring the README up to date and log the Notes app ([`e248eee`](https://github.com/Larmeal/learning-garden/commit/e248eee4bf75eb6e1b90d5945460352d14a003ed))
- add the /audit procedure for the Notes app, describe the dev tools in claude.md, and list yaml as a dependency ([`9eba07d`](https://github.com/Larmeal/learning-garden/commit/9eba07dbd8cbc63e6c302144d44e56c38d76364c))
- say what was checked in a browser, and record the translation-sync state ([`05cba04`](https://github.com/Larmeal/learning-garden/commit/05cba042141f73098fb774e7961d416f61d3a163))
- note the Spark overview page, the timeline lab and the Thai writing voice ([`0d723a4`](https://github.com/Larmeal/learning-garden/commit/0d723a406ce6c90b015a4e07dc3f98e631b710b9))

## 2026-11-07

### Added

- **site**: move the step-by-step switch to the header and add a dev-only MDX editor ([`9016138`](https://github.com/Larmeal/learning-garden/commit/90161382921c9d1661e85004045d9227b108aa1b))
- **site**: keep Thai and English lessons in step, and edit MDX inside the page layout ([`e5ea741`](https://github.com/Larmeal/learning-garden/commit/e5ea74193209d2425d54105d7217ed117997c126))
- **spark**: redo FormatLab to compare CSV and Parquet side by side ([`e32cce1`](https://github.com/Larmeal/learning-garden/commit/e32cce16747b65b431763b2aa71482adf01d31ce))

### Fixed

- **spark**: replace two labs with tables, restyle the phase pills, say "lesson" in English text ([`1581ba0`](https://github.com/Larmeal/learning-garden/commit/1581ba00f044f2faf2ddf784d67d57b460d24ae8))
- **great-expectations**: shorten the English labels inside three diagrams ([`2dccf6c`](https://github.com/Larmeal/learning-garden/commit/2dccf6c31116ed7a0648ac5c6e8ec80202a6e875))
- **spark**: stop text and dots covering each other in seven labs, and add a changelog ([`fd3f572`](https://github.com/Larmeal/learning-garden/commit/fd3f5722a72ca639ec95a9c2821321bd79e2f117))

## 2026-11-06

### Added

- **spark**: add clock-based animation labs and make every Spark lab bilingual ([`11c7d9f`](https://github.com/Larmeal/learning-garden/commit/11c7d9f877e8255009c83f205c8f1363aed08bdd))
- **spark**: add cluster manager sub-pages, exercises 06b and 11b, and fix findings ([`dd5e64d`](https://github.com/Larmeal/learning-garden/commit/dd5e64dd8ed0bf2c28450372dc7c02174aca7bb7))
- make the guitar, music-theory and great-expectations labs bilingual ([`2b32cd3`](https://github.com/Larmeal/learning-garden/commit/2b32cd3f772f4d30af2746a5582dc767fdf8df77))
- **i18n**: add English lessons for spark, great-expectations, guitar and music-theory ([`bbd8dda`](https://github.com/Larmeal/learning-garden/commit/bbd8ddaea0c4438cf7131ebdc1cdc0bec8ddfceb))

### Fixed

- **lessons**: correct facts found while reviewing the English translation ([`3ad2ed9`](https://github.com/Larmeal/learning-garden/commit/3ad2ed9f0b1d6c5a69ac13cfcee71e6205412f7b))

## 2026-11-05

### Added

- **pydantic**: add the pydantic subject with 12 lessons in Thai and English ([`623f1e5`](https://github.com/Larmeal/learning-garden/commit/623f1e54bd1245f67e02b19c35b6ada2821af622))
- **pytest**: go deeper, 15 lessons with the inside of pytest, in-depth pages and a plugin ([`eb32fb2`](https://github.com/Larmeal/learning-garden/commit/eb32fb2b5adb3f46af8e75d5c60f111079bddbba))
- **spark**: add 24 animated labs with a shared step player ([`297f87c`](https://github.com/Larmeal/learning-garden/commit/297f87cc63e7e80d0aa692ec44849db64d4aec35))
- **spark**: add exercises 01 to 13, verify.py and verified findings, run in WSL where Hadoop needs it ([`15e2089`](https://github.com/Larmeal/learning-garden/commit/15e20891f991fc2d144e180cde2263ae158417d5))
- **spark**: go deeper on chapters 0 to 5, add in-depth pages and an execution-model quiz ([`65aa5d8`](https://github.com/Larmeal/learning-garden/commit/65aa5d8377abac55e299d97809dc1fd2d7ff253a))
- **spark**: write chapters 6 to 13 (Catalyst, tuning, UDF, streaming, table formats, deployment, MLlib, internals) ([`0a7d79a`](https://github.com/Larmeal/learning-garden/commit/0a7d79a851fdf49e1442339bb92fbe8fe80c5800))

## 2026-11-04

### Added

- **site**: language menu, theme button in the step player, lesson links, cleaner page list ([`04d24f5`](https://github.com/Larmeal/learning-garden/commit/04d24f574e8675d0ff03adfdfa64c6bc9b8ec08e))
- **data-quality**: ten steps, governance, a page per dimension, contracts in practice ([`fbce051`](https://github.com/Larmeal/learning-garden/commit/fbce051c2aeab1f6577873e695dfb16f7fad805f))
- **pytest**: add the pytest subject with 8 lessons in Thai and English ([`b122458`](https://github.com/Larmeal/learning-garden/commit/b122458b063589503c14ed93b550f3ad45068f6f))

## 2026-11-02

### Added

- **site**: add the guitar and music theory subjects ([`0e5c74c`](https://github.com/Larmeal/learning-garden/commit/0e5c74c22583a06628b486ba1088c67eecfe9543))
- **data-quality**: add exercises, shared modules and notes for the Data Quality subject ([`5a90066`](https://github.com/Larmeal/learning-garden/commit/5a90066206458ac685dec6f9ad7e7dc436edff3e))
- **site**: add the Data Quality subject with 11 lessons, quizzes and three labs ([`74c4469`](https://github.com/Larmeal/learning-garden/commit/74c4469134d5433563c7a4db4cd79eae6a859a8c))
- **site**: support Thai and English pages ([`df4bcca`](https://github.com/Larmeal/learning-garden/commit/df4bcca834550251662876a98857f6f55eee117f))
- **data-quality**: add the English lessons and quizzes ([`2c663b9`](https://github.com/Larmeal/learning-garden/commit/2c663b96a068e246caba6f265439ec44e8a1ee87))

### Docs

- keep technical terms in English in the Thai data-quality lessons ([`1850d5b`](https://github.com/Larmeal/learning-garden/commit/1850d5b06a9805546604ba7367caf1c212cfbccc))

## 2026-10-29

### Added

- **gx**: add runnable exercises pinned to Great Expectations 1.24.1 ([`74b9a9a`](https://github.com/Larmeal/learning-garden/commit/74b9a9aaf1d939a5b80dd4e68158211ea88c93ef))
- **site**: add the Great Expectations labs ([`184a8b7`](https://github.com/Larmeal/learning-garden/commit/184a8b7f0d90082a33c6871b87fe3cdab0044194))
- **site**: add the Great Expectations learning path ([`ab22669`](https://github.com/Larmeal/learning-garden/commit/ab22669faae50e397cb00381e65984f3fa5b35f0))
- **gx**: deepen lesson 0 with three sub-pages and generic lab components ([`3de4037`](https://github.com/Larmeal/learning-garden/commit/3de403759cc6e9952d3800558d8e2d4ba469db8f))
- **gx**: deepen lesson 1 with build chain, references and first errors ([`a89fa36`](https://github.com/Larmeal/learning-garden/commit/a89fa3668899b9345673ceac2a479c1fe4881043))
- **gx**: deepen lesson 2 with result anatomy, rerun and practice ([`8005daa`](https://github.com/Larmeal/learning-garden/commit/8005daa5152647a8c181c11e90779b36cd04f84f))
- **gx**: deepen lesson 3 with family catalog, null and order, suite editing ([`9c049c1`](https://github.com/Larmeal/learning-garden/commit/9c049c1021fb2c13276a4a753b7e6328ea043d3a))
- **gx**: deepen lesson 4 with result formats, vacuous passes and triage ([`c59b8e0`](https://github.com/Larmeal/learning-garden/commit/c59b8e0182a14eb303ff12999736c2ce3d540a01))
- **gx**: deepen lesson 5 and record that GX Cloud is shut down in 1.24.1 ([`8702533`](https://github.com/Larmeal/learning-garden/commit/87025339cafb407e8ef6c658ac7f3546edb3a8cd))
- **gx**: deepen lesson 6 with SQL partitioners, filename patterns and batch.validate ([`78e84ec`](https://github.com/Larmeal/learning-garden/commit/78e84ecb1b44ceab056f61224fa848896d3f37be))
- **gx**: deepen lesson 7 with multi-validation checkpoints, result shape and vd versus checkpoint ([`7cf139e`](https://github.com/Larmeal/learning-garden/commit/7cf139e8598f1e9c2f3630b8037aababb0b1f660))
- **gx**: deepen lesson 8 with the metric registry, domains and retries ([`9b77d35`](https://github.com/Larmeal/learning-garden/commit/9b77d35b15ab8b6043a3e0a9cabd2465450907be))
- **gx**: deepen lesson 9 with the notify matrix, custom actions and Data Docs reading ([`d4b200c`](https://github.com/Larmeal/learning-garden/commit/d4b200c55f55f0374c6d914db8358ba327d2cdf3))
- **gx**: deepen lesson 10 with failure policies, daily runs and gate tests ([`9802796`](https://github.com/Larmeal/learning-garden/commit/9802796ccc988a531be0b16ad61ce54930238cd9))
- **gx**: deepen lesson 11 with real SQL statements, the support matrix and a Spark source reading ([`c4ab743`](https://github.com/Larmeal/learning-garden/commit/c4ab743beb8c6de1f5ca83250abaf1f9486daac5))
- **gx**: deepen lesson 13 with a recorded call trace, graph queries and the 1.9.3 to 1.24.1 diff ([`6987013`](https://github.com/Larmeal/learning-garden/commit/69870138113c9a3ba2b390e8e6faa29b3667c12e))
- **gx**: add three questions per quiz from the new sub-pages and refresh the overview ([`6a89021`](https://github.com/Larmeal/learning-garden/commit/6a8902196aacf423eb2645f875ca73137d5348a1))

### Fixed

- **gx**: repair layouts found by looking at the pages in a browser ([`ed05d0e`](https://github.com/Larmeal/learning-garden/commit/ed05d0e2fcff471a46aaada25b033f0606876c5d))

### Docs

- **gx**: add the overview and the verified-findings notes ([`b159890`](https://github.com/Larmeal/learning-garden/commit/b1598909b85310bb341885c75c12744c5026b554))

## 2026-10-26

### Added

- **graphs**: add generated spark indexes for rules, configs and physical operators ([`c5eea34`](https://github.com/Larmeal/learning-garden/commit/c5eea34b8ba56662de5cd5c89fef6e9beee53263))
- **graphs**: add great_expectations knowledge graph snapshot (v1.9.3) ([`fb4fb02`](https://github.com/Larmeal/learning-garden/commit/fb4fb022a2a5f30bbc499a251b22bdd54ecedbcd))
- **site**: group subjects by category on the home page and continue from progress ([`3ebb372`](https://github.com/Larmeal/learning-garden/commit/3ebb372ee6a3ca98fce6d57702a88e3604e2c78c))

### Changed

- **site**: move the Spark labs into components/labs/spark ([`3839c30`](https://github.com/Larmeal/learning-garden/commit/3839c307c0c97943ba832d21fd4e233aeb49a520))
- move everything outside the site into subjects/<id>/ ([`f6729bb`](https://github.com/Larmeal/learning-garden/commit/f6729bb59a63f73e1929d61da90e31d82515be8f))

### Docs

- **graphs**: add spark resume guide, backlog, progress log and lesson notes ([`18515df`](https://github.com/Larmeal/learning-garden/commit/18515df43bb5585a1576e83e2aa414711af7a88a))

## 2026-10-23

### Added

- **site**: lessons can have sub-pages, progress is counted per page ([`3f91832`](https://github.com/Larmeal/learning-garden/commit/3f91832575dfad6ac0462e0e79ff017e04924e2d))

### Other

- content: **site**: move the check-yourself questions of lessons 00 to 04 into quiz pages ([`648bf9b`](https://github.com/Larmeal/learning-garden/commit/648bf9bb73372eb7eb826a2b8fa5e77888763a5d))

## 2026-10-22

### Added

- add SparkSession helper and smoke test ([`b88fbbd`](https://github.com/Larmeal/learning-garden/commit/b88fbbdd107ab017779677a11dfd19fb9f02df59))
- **site**: add Learning Garden app with lesson 00 ([`7ab1235`](https://github.com/Larmeal/learning-garden/commit/7ab12353ddc4b8690bd48039168948d488d785c8))
- **site**: add lesson 01 on Spark architecture ([`aefeee4`](https://github.com/Larmeal/learning-garden/commit/aefeee4035fdf7a44de81298a61b1564003f77c4))
- **site**: add lesson 02 on lazy evaluation ([`2949cf6`](https://github.com/Larmeal/learning-garden/commit/2949cf61896abc6c29bfbe03fa8cced7dd6fdcac))
- **site**: add lesson 03 on DataFrame and Spark SQL ([`e1c5124`](https://github.com/Larmeal/learning-garden/commit/e1c5124fee34714abae9718de93d51f4722047ec))
- **site**: add lesson 04 on data I/O ([`141fa48`](https://github.com/Larmeal/learning-garden/commit/141fa48d89ea23c4e613190df3fb8cb9db9366af))
- **site**: add Execution model lesson with shuffle and skew demos ([`0274521`](https://github.com/Larmeal/learning-garden/commit/02745218553729c547f73a900656b4f7e1bea032))
- **site**: add seed lessons for phases B to E ([`cdc3fdf`](https://github.com/Larmeal/learning-garden/commit/cdc3fdfc175be35b20729a519e6c962868950b08))
- **site**: make the home garden alive and responsive to the pointer ([`dbe8a1d`](https://github.com/Larmeal/learning-garden/commit/dbe8a1df487a25053022408b1082c4c4b5f8c045))
- **site**: require every question answered before a lesson can be ticked ([`84714fc`](https://github.com/Larmeal/learning-garden/commit/84714fc9a96e1e3a9eeda0b25f2ef0a768334399))
- **site**: bring the living garden to every page and grow plants with progress ([`930b204`](https://github.com/Larmeal/learning-garden/commit/930b204bac3c8bfadb5634915cc67d990721223c))

### Docs

- add Spark learning overview ([`0dfbf5a`](https://github.com/Larmeal/learning-garden/commit/0dfbf5a3b2e2d0d07a01620cb53346825a0cfaa5))
