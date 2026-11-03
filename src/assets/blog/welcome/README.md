# Welcome article photos

Put photos in this folder using these names (choose jpg, jpeg, png or webp; uppercase extensions are accepted):

- cover.jpg — featured image on /blog and at the top of the article. Could be Michael at a booth, Rocks Cafe, the shop crates, or Kopi.
- kopi-1.jpg — first cat photo after the paragraph introducing Kopi’s pictures.
- kopi-2.jpg — second cat photo in the same gallery.
- kopi-3.jpg — third cat photo in the same gallery.
- behind-the-scenes.jpg — optional packing / crates / Rocks Cafe photo after the behind-the-scenes section.

File names are matched without case sensitivity. Include only one version of each named photo. Images appear after saving and refreshing the local dev site; rebuild when deploying later. Missing files are omitted without broken image icons. There is an editorial cover design until cover.jpg is added. The author’s cat-photo introduction remains as supplied, so add Kopi’s photos before publishing.

The cat gallery uses square crops; use square photographs or adjust object-cover to object-contain in BlogArticlePage.tsx if you want the full portrait visible. The cover is cropped on the blog listing and contained in the article. Aim for JPEG/WebP images around 1400px wide and a few hundred KB for mobile loading.
