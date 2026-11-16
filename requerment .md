# Project: Harihaat 2026 – Decoration & Idea Management App

## 1. Project Overview

We celebrate Harihaat every year at **Shree Gondawale Dham, Indore**. For Harihaat 2026, the decoration theme is based on the **51 Shakti Peeths of Mata Ji**.

Managing the decoration planning has become challenging because multiple team members contribute ideas, references, images, and suggestions. Additionally, organizing decoration-related materials, maintaining information for each Shakti Peeth, and managing the overall creative planning process becomes difficult when everything is scattered across different platforms.

To solve this problem, we want to develop a simple, responsive, and flexible web application where all team members can manage ideas, decoration references, images, and notes in one centralized place.

The primary goal is to make decoration planning, collaboration, and information management simple and efficient.

## 2. Main Application Structure

The application homepage should contain multiple sections.

Initially, there will be two main sections:

1. **Idea Contributor**
2. **Decoration Management**

Each section should have its own dedicated page and management functionality.

---

## 3. Idea Contributor Section

This section will allow multiple team members to contribute, manage, and explore decoration ideas.

### 3.1 Ideas Listing Page

When a user opens the Idea Contributor section, display all previously submitted ideas.

The page should support:

- Displaying multiple ideas in a clean card-based layout.
- Adding new ideas.
- Searching existing ideas.
- Opening an individual idea to view its complete details.
- Editing existing ideas.
- Deleting ideas.
- Providing a simple and convenient way to browse all contributions.

### 3.2 Add New Idea

When a user clicks the Add Idea option, open a form-style UI.

The form should contain:

- **Idea Title:** Name or heading of the idea.
- **Description:** Detailed explanation of the idea.
- **Reference Links:** Support multiple links, including YouTube videos, Google references, websites, and other useful resources.
- **Image Upload:** Allow users to upload multiple images related to the idea.

Users should be able to add and manage multiple reference links and images.

### 3.3 Idea Details Page

When a user opens an idea, display its complete information.

The details page should include:

- Idea title.
- Complete description.
- All reference links.
- Uploaded images in a gallery format.
- Options to edit the idea.
- Option to delete the idea.

The overall experience should make it easy for team members to understand an idea and explore its references.

---

## 4. Decoration Management Section

This is the primary section of the application.

It will contain information about all **51 Shakti Peeths of Mata Ji**.

Each Shakti Peeth will have its own dedicated section where team members can manage decoration-related information, creative references, images, and notes.

### 4.1 Shakti Peeth Listing Page

Display all 51 Shakti Peeths on a dedicated page.

The page should support:

- Displaying all 51 Shakti Peeths.
- Card-based or list-based layouts.
- Each card should display the Mata Ji / Shakti Peeth name.
- Display the location/place of the Shakti Peeth.
- A short description.
- Clicking any Shakti Peeth should navigate to its dedicated details page.
- Search functionality to find a particular Shakti Peeth.

### 4.2 Individual Shakti Peeth Details Page

Every Shakti Peeth should have its own dedicated details page.

The page should contain the following sections:

**A. Basic Information**

Display and manage:

- Shakti Peeth / Mata Ji name.
- Place or location.
- Short description about the Shakti Peeth.

Users should be able to edit all these details directly through the UI.

**B. Decoration Reference Gallery**

This section is important for decoration planning.

For each individual Shakti Peeth, provide a dedicated image gallery where team members can upload and manage images that will help them create decoration crafts and structures representing that particular Mata Ji.

Features:

- Upload multiple images.
- Display uploaded images in a gallery.
- View images in a larger preview.
- Delete images.
- Add more images whenever required.
- Keep images associated with their respective Shakti Peeth.

The gallery should serve as a centralized collection of visual references for the decoration team.

**C. Reference Links**

Provide functionality similar to the Idea Contributor section.

Users should be able to:

- Add multiple reference links.
- Add YouTube video links.
- Add Google reference links.
- Add other useful websites or resources.
- Edit existing links.
- Delete links.

**D. Notes Management**

Every Shakti Peeth should have its own notes section.

This section will allow team members to maintain multiple notes related to decoration planning.

Features:

- Add multiple notes.
- Edit existing notes.
- Delete notes.
- View all notes associated with that particular Shakti Peeth.

Notes can contain decoration-related information, important suggestions, creative thoughts, or any other useful details.

The notes should be independently manageable for each Shakti Peeth.

---

## 5. Flexibility and Management Requirements

The application should provide flexibility to manage information without requiring changes in the code.

All major information should be manageable directly through the UI.

Important requirements:

- Users should be able to add, edit, and delete ideas.
- Users should be able to add, edit, and delete Shakti Peeth information.
- Users should be able to upload and manage multiple images.
- Users should be able to manage multiple reference links.
- Users should be able to maintain multiple notes.
- All information should remain associated with its respective idea or Shakti Peeth.
- Users should be able to search and explore information easily.
- The UI should remain simple and easy to understand for all team members.

The application should be flexible enough to accommodate changes and additional information during the decoration planning process.

---

## 6. Technical Requirements

### Frontend and Backend

- Use **Next.js** for the complete application.
- Use a normal Next.js application architecture.
- Keep the application simple, maintainable, and easy to extend.
- The frontend should communicate with the backend for all persistent data operations.

### Database

- Use **MongoDB** as the primary database.
- Store all application data in MongoDB.
- Store idea details, Shakti Peeth information, descriptions, reference links, and notes in MongoDB.
- Store image URLs and their associated information in MongoDB.

### Image Storage

- Store uploaded images in a public GitHub repository.
- The backend should connect with the GitHub repository to manage image uploads.
- Upload images to GitHub and retrieve their public URLs.
- Store the resulting image URLs in MongoDB.
- Maintain the association between images and their respective ideas or Shakti Peeths.

### Frontend Data Persistence and Caching

Use browser-side storage to improve responsiveness and user experience.

- Use IndexedDB and/or LocalStorage to maintain suitable application data on the frontend.
- Cache previously fetched information where appropriate.
- Reduce unnecessary backend requests.
- Make navigation between sections and previously loaded information faster.
- Keep frontend cached data synchronized with backend data.
- MongoDB should remain the primary source of truth for persistent application data.

### Application Access / Password Protection

Before entering the application, users should see a password-protected entry screen.

- Application password: **shri ram**
- Users must enter the correct password to access the application.
- Without the correct password, users should not be able to access the application pages.

---

## 7. Responsive UI Requirements

The complete application must be mobile-friendly and responsive across all screen sizes.

Support:

- Mobile phones.
- Tablets.
- Laptops.
- Desktop screens.

UI expectations:

- Simple and clean interface.
- Easy navigation between the main sections.
- Responsive card and list layouts.
- Mobile-friendly forms.
- Convenient image gallery experience.
- Easy-to-use add, edit, and delete operations.
- Consistent UI across all pages.

The application should prioritize simplicity and ease of use rather than unnecessary complexity.

---

## 8. Final Objective

Build a centralized **Harihaat 2026 Decoration & Idea Management Application** for Shree Gondawale Dham, Indore.

The application should help multiple team members collaborate by maintaining:

1. All decoration ideas in one place.
2. Information about all 51 Shakti Peeths.
3. Decoration reference images for every Shakti Peeth.
4. Useful reference links and resources.
5. Multiple notes for individual Shakti Peeths.
6. Easy management of all information through a simple UI.

The final result should be a simple, flexible, responsive, and efficient application that makes managing the complete Harihaat 2026 decoration planning process easier.



mataji content should we in hindi 
{
  "title": "माँ सती के 51 शक्तिपीठ",
  "description": "माँ सती के पवित्र अंगों और आभूषणों के पतन से जुड़े 51 शक्तिपीठ, जहाँ आदिशक्ति विभिन्न दिव्य स्वरूपों में विराजमान हैं।",
  "totalShaktiPeeth": 51,
  "shaktiPeeths": [
    {
      "id": 1,
      "name": "हिंगुला शक्तिपीठ",
      "place": "हिंगलाज, बलूचिस्तान, पाकिस्तान",
      "description": "यह पवित्र शक्तिपीठ माँ कोट्टरी को समर्पित है। इसे माँ सती के ब्रह्मरंध्र के पतन से जुड़ा माना जाता है।"
    },
    {
      "id": 2,
      "name": "करवीर शक्तिपीठ",
      "place": "कोल्हापुर, महाराष्ट्र, भारत",
      "description": "यहाँ माँ महिषमर्दिनी की आराधना की जाती है। यह स्थान माँ आदिशक्ति के दिव्य स्वरूप और शक्ति का प्रतीक है।"
    },
    {
      "id": 3,
      "name": "सुगंधा शक्तिपीठ",
      "place": "शिकारपुर, बारीसाल, बांग्लादेश",
      "description": "यह शक्तिपीठ माँ सुनंदा को समर्पित है। मान्यता है कि यहाँ माता सती की नासिका का पतन हुआ था।"
    },
    {
      "id": 4,
      "name": "कश्मीर शक्तिपीठ",
      "place": "कश्मीर, भारत (सटीक स्थान अनिश्चित)",
      "description": "यहाँ माँ महामाया की आराधना की जाती है। धार्मिक मान्यता के अनुसार यह स्थान माता सती के कंठ से संबंधित है।"
    },
    {
      "id": 5,
      "name": "ज्वालामुखी शक्तिपीठ",
      "place": "ज्वालामुखी, कांगड़ा, हिमाचल प्रदेश, भारत",
      "description": "यहाँ माँ ज्वाला के रूप में विराजमान हैं। मान्यता है कि यहाँ माता सती की जिह्वा का पतन हुआ था।"
    },
    {
      "id": 6,
      "name": "जालंधर शक्तिपीठ",
      "place": "जालंधर क्षेत्र, पंजाब, भारत (स्थान को लेकर मतभेद)",
      "description": "यह शक्तिपीठ माँ त्रिपुरमालिनी को समर्पित है। इसे माता सती के स्तन से संबंधित पवित्र स्थान माना जाता है।"
    },
    {
      "id": 7,
      "name": "वैद्यनाथ शक्तिपीठ",
      "place": "देवघर, झारखंड, भारत",
      "description": "यहाँ माँ जयदुर्गा की आराधना की जाती है। मान्यता है कि इस स्थान पर माता सती के हृदय का पतन हुआ था।"
    },
    {
      "id": 8,
      "name": "नेपाल शक्तिपीठ",
      "place": "काठमांडू, नेपाल (स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ महामाया को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती के दोनों घुटनों का पतन हुआ था।"
    },
    {
      "id": 9,
      "name": "मानस शक्तिपीठ",
      "place": "मानसरोवर, तिब्बत, चीन (स्थान को लेकर मतभेद)",
      "description": "यहाँ माँ दाक्षायणी की आराधना की जाती है। इसे माता सती के दाहिने हाथ से संबंधित शक्तिपीठ माना जाता है।"
    },
    {
      "id": 10,
      "name": "विरजा शक्तिपीठ",
      "place": "जाजपुर, ओडिशा, भारत",
      "description": "यहाँ माँ विरजा अथवा विमला के रूप में विराजमान हैं। मान्यता है कि यहाँ माता सती की नाभि का पतन हुआ था।"
    },
    {
      "id": 11,
      "name": "गंडकी शक्तिपीठ",
      "place": "मुक्तिनाथ क्षेत्र, नेपाल",
      "description": "यह शक्तिपीठ माँ गंडकी चंडी को समर्पित है। इसे माता सती के गाल से संबंधित पवित्र स्थान माना जाता है।"
    },
    {
      "id": 12,
      "name": "बहुला शक्तिपीठ",
      "place": "केतुग्राम, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ बहुला की पूजा की जाती है। मान्यता है कि इस स्थान पर माता सती की बाईं भुजा का पतन हुआ था।"
    },
    {
      "id": 13,
      "name": "उज्जयिनी शक्तिपीठ",
      "place": "उज्जैन, मध्य प्रदेश, भारत (उजानी, पश्चिम बंगाल की भी मान्यता)",
      "description": "यह शक्तिपीठ माँ मंगलचंडी को समर्पित है। इसे माता सती की कोहनी से संबंधित पवित्र स्थान माना जाता है।"
    },
    {
      "id": 14,
      "name": "चट्टल शक्तिपीठ",
      "place": "सीताकुंड, चटगाँव, बांग्लादेश",
      "description": "यहाँ माँ भवानी की आराधना की जाती है। मान्यता है कि यहाँ माता सती की दाहिनी भुजा का पतन हुआ था।"
    },
    {
      "id": 15,
      "name": "त्रिपुरा सुंदरी शक्तिपीठ",
      "place": "उदयपुर, गोमती जिला, त्रिपुरा, भारत",
      "description": "यहाँ माँ त्रिपुरसुंदरी विराजमान हैं। यह शक्तिपीठ माता सती के दाहिने पैर से जुड़ा माना जाता है।"
    },
    {
      "id": 16,
      "name": "त्रिस्रोता शक्तिपीठ",
      "place": "सालबाड़ी, जलपाईगुड़ी, पश्चिम बंगाल, भारत",
      "description": "यह शक्तिपीठ माँ भ्रामरी को समर्पित है। मान्यता है कि यहाँ माता सती के बाएँ पैर का पतन हुआ था।"
    },
    {
      "id": 17,
      "name": "कामाख्या शक्तिपीठ",
      "place": "नीलांचल पर्वत, गुवाहाटी, असम, भारत",
      "description": "यहाँ माँ कामाख्या देवी के रूप में विराजमान हैं। यह शक्तिपीठ माता सती की महामुद्रा अर्थात योनि के पतन से जुड़ा है।"
    },
    {
      "id": 18,
      "name": "युगाद्या शक्तिपीठ",
      "place": "क्षीरग्राम, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ युगाद्या की पूजा की जाती है। मान्यता है कि यहाँ माता सती के दाहिने पैर के अंगूठे का पतन हुआ था।"
    },
    {
      "id": 19,
      "name": "कालीघाट शक्तिपीठ",
      "place": "कालीघाट, कोलकाता, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ काली विराजमान हैं। मान्यता है कि इस स्थान पर माता सती के दाहिने पैर की उंगलियों का पतन हुआ था।"
    },
    {
      "id": 20,
      "name": "प्रयाग शक्तिपीठ",
      "place": "प्रयागराज, उत्तर प्रदेश, भारत",
      "description": "यहाँ माँ ललिता देवी की आराधना की जाती है। मान्यता है कि यहाँ माता सती की उंगलियों का पतन हुआ था।"
    },
    {
      "id": 21,
      "name": "जयंती शक्तिपीठ",
      "place": "सिलहट क्षेत्र, बांग्लादेश",
      "description": "यह शक्तिपीठ माँ जयंती को समर्पित है। इसे माता सती की बाईं जंघा के पतन से जुड़ा माना जाता है।"
    },
    {
      "id": 22,
      "name": "किरीट शक्तिपीठ",
      "place": "किरीटकोना, मुर्शिदाबाद, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ विमला अथवा भुवनेशी की आराधना की जाती है। मान्यता है कि यहाँ माता सती का मुकुट गिरा था।"
    },
    {
      "id": 23,
      "name": "विशालाक्षी शक्तिपीठ",
      "place": "मणिकर्णिका घाट, वाराणसी, उत्तर प्रदेश, भारत",
      "description": "यहाँ माँ विशालाक्षी विराजमान हैं। मान्यता है कि इस स्थान पर माता सती के कान का कुंडल गिरा था।"
    },
    {
      "id": 24,
      "name": "कन्याश्रम शक्तिपीठ",
      "place": "चटगाँव क्षेत्र, बांग्लादेश (स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ सर्वाणी को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती की पीठ का पतन हुआ था।"
    },
    {
      "id": 25,
      "name": "कुरुक्षेत्र शक्तिपीठ",
      "place": "कुरुक्षेत्र, हरियाणा, भारत",
      "description": "यहाँ माँ सावित्री की आराधना की जाती है। मान्यता है कि यहाँ माता सती के टखने का पतन हुआ था।"
    },
    {
      "id": 26,
      "name": "मणिबंध शक्तिपीठ",
      "place": "पुष्कर क्षेत्र, अजमेर, राजस्थान, भारत (स्थान को लेकर मतभेद)",
      "description": "यह शक्तिपीठ माँ गायत्री को समर्पित माना जाता है। धार्मिक मान्यता के अनुसार यहाँ माता सती की दोनों कलाइयों का पतन हुआ था।"
    },
    {
      "id": 27,
      "name": "श्रीशैल शक्तिपीठ",
      "place": "श्रीहट्ट, सिलहट, बांग्लादेश अथवा श्रीशैलम, भारत (मतभेद)",
      "description": "यहाँ माँ महालक्ष्मी की आराधना की जाती है। मान्यता है कि इस स्थान पर माता सती की गर्दन का पतन हुआ था।"
    },
    {
      "id": 28,
      "name": "कांची शक्तिपीठ",
      "place": "कांची क्षेत्र, पश्चिम बंगाल अथवा कांचीपुरम, तमिलनाडु, भारत (मतभेद)",
      "description": "यह शक्तिपीठ माँ देवगर्भा को समर्पित है। इसे माता सती की अस्थियों से संबंधित पवित्र स्थान माना जाता है।"
    },
    {
      "id": 29,
      "name": "कालमाधव शक्तिपीठ",
      "place": "स्थान अनिश्चित, मध्य भारत की परंपरा से संबंधित",
      "description": "यहाँ माँ काली की आराधना की जाती है। मान्यता है कि इस स्थान पर माता सती के नितंब का पतन हुआ था।"
    },
    {
      "id": 30,
      "name": "शोण शक्तिपीठ",
      "place": "शोण अथवा नर्मदा नदी क्षेत्र, मध्य भारत (स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ नर्मदा को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती के नितंब का पतन हुआ था।"
    },
    {
      "id": 31,
      "name": "रामगिरि शक्तिपीठ",
      "place": "रामटेक, नागपुर, महाराष्ट्र अथवा चित्रकूट, भारत (मतभेद)",
      "description": "यहाँ माँ शिवानी विराजमान हैं। मान्यता है कि इस स्थान पर माता सती के स्तन का पतन हुआ था।"
    },
    {
      "id": 32,
      "name": "वृंदावन शक्तिपीठ",
      "place": "वृंदावन, मथुरा, उत्तर प्रदेश, भारत",
      "description": "यह शक्तिपीठ माँ उमा को समर्पित है। मान्यता है कि यहाँ माता सती के केशों का पतन हुआ था।"
    },
    {
      "id": 33,
      "name": "शुचि शक्तिपीठ",
      "place": "शुचिंद्रम क्षेत्र, तमिलनाडु, भारत (सटीक पहचान अनिश्चित)",
      "description": "यहाँ माँ नारायणी की आराधना की जाती है। धार्मिक मान्यता के अनुसार यहाँ माता सती के ऊपरी दाँतों का पतन हुआ था।"
    },
    {
      "id": 34,
      "name": "पंचसागर शक्तिपीठ",
      "place": "पंचसागर क्षेत्र, भारत (सटीक स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ वाराही को समर्पित है। मान्यता है कि यहाँ माता सती के निचले दाँतों का पतन हुआ था।"
    },
    {
      "id": 35,
      "name": "करतोया तट शक्तिपीठ",
      "place": "भवानीपुर, बोगरा, बांग्लादेश",
      "description": "यहाँ माँ अपर्णा विराजमान हैं। धार्मिक मान्यता के अनुसार इस स्थान पर माता सती के बाएँ कान का पतन हुआ था।"
    },
    {
      "id": 36,
      "name": "श्रीपर्वत शक्तिपीठ",
      "place": "श्रीशैल पर्वत क्षेत्र, आंध्र प्रदेश, भारत (स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ सुंदरी को समर्पित है। मान्यता है कि यहाँ माता सती के दाहिने टखने का पतन हुआ था।"
    },
    {
      "id": 37,
      "name": "विभाष शक्तिपीठ",
      "place": "तमलुक, पूर्व मेदिनीपुर, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ कपालिनी अथवा भीमरूपा की पूजा की जाती है। मान्यता है कि यहाँ माता सती के बाएँ टखने का पतन हुआ था।"
    },
    {
      "id": 38,
      "name": "प्रभास शक्तिपीठ",
      "place": "प्रभास पाटन, सोमनाथ, गुजरात, भारत",
      "description": "यह शक्तिपीठ माँ चंद्रभागा को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती के उदर का पतन हुआ था।"
    },
    {
      "id": 39,
      "name": "भैरव पर्वत शक्तिपीठ",
      "place": "उज्जैन क्षेत्र, मध्य प्रदेश, भारत",
      "description": "यहाँ माँ अवंती विराजमान हैं। मान्यता है कि इस स्थान पर माता सती के ऊपरी होंठ का पतन हुआ था।"
    },
    {
      "id": 40,
      "name": "जनस्थान शक्तिपीठ",
      "place": "नासिक, महाराष्ट्र, भारत",
      "description": "यह शक्तिपीठ माँ भ्रामरी को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती की ठोड़ी का पतन हुआ था।"
    },
    {
      "id": 41,
      "name": "गोदावरी तट शक्तिपीठ",
      "place": "गोदावरी नदी तट, आंध्र प्रदेश क्षेत्र, भारत",
      "description": "यहाँ माँ विश्वेशी अथवा राकिनी की आराधना की जाती है। मान्यता है कि यहाँ माता सती के बाएँ गाल का पतन हुआ था।"
    },
    {
      "id": 42,
      "name": "रत्नावली शक्तिपीठ",
      "place": "खानाकुल क्षेत्र, हुगली, पश्चिम बंगाल, भारत (संभावित स्थान)",
      "description": "यह शक्तिपीठ माँ कुमारी को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती के दाहिने कंधे का पतन हुआ था।"
    },
    {
      "id": 43,
      "name": "मिथिला शक्तिपीठ",
      "place": "जनकपुर क्षेत्र, नेपाल",
      "description": "यहाँ माँ उमा अथवा महादेवी विराजमान हैं। मान्यता है कि इस स्थान पर माता सती के बाएँ कंधे का पतन हुआ था।"
    },
    {
      "id": 44,
      "name": "नलहाटी शक्तिपीठ",
      "place": "नलहाटी, बीरभूम, पश्चिम बंगाल, भारत",
      "description": "यह शक्तिपीठ माँ काली को समर्पित है। धार्मिक मान्यता के अनुसार यहाँ माता सती की नलिका अस्थि का पतन हुआ था।"
    },
    {
      "id": 45,
      "name": "कालिघाट शक्तिपीठ",
      "place": "जुरानपुर, कटवा क्षेत्र, पश्चिम बंगाल, भारत (पीठनिर्णय परंपरा की एक पहचान)",
      "description": "यहाँ माँ जयदुर्गा की आराधना की जाती है। इस शक्तिपीठ की पहचान और माता सती के अंग को लेकर विभिन्न परंपराओं में मतभेद हैं।"
    },
    {
      "id": 46,
      "name": "वक्रेश्वर शक्तिपीठ",
      "place": "बक्रेश्वर, बीरभूम, पश्चिम बंगाल, भारत",
      "description": "यह शक्तिपीठ माँ महिषमर्दिनी को समर्पित है। मान्यता है कि यहाँ माता सती के मन का पतन हुआ था।"
    },
    {
      "id": 47,
      "name": "यशोरेश्वरी शक्तिपीठ",
      "place": "ईश्वरपुर, खुलना क्षेत्र, बांग्लादेश",
      "description": "यहाँ माँ यशोरेश्वरी विराजमान हैं। धार्मिक मान्यता के अनुसार यहाँ माता सती के हाथ का पतन हुआ था।"
    },
    {
      "id": 48,
      "name": "अट्टहास शक्तिपीठ",
      "place": "लाभपुर, बीरभूम, पश्चिम बंगाल, भारत",
      "description": "यह शक्तिपीठ माँ फुल्लरा को समर्पित है। मान्यता है कि इस स्थान पर माता सती के होंठों का पतन हुआ था।"
    },
    {
      "id": 49,
      "name": "नंदीपुर शक्तिपीठ",
      "place": "सैंथिया, बीरभूम, पश्चिम बंगाल, भारत",
      "description": "यहाँ माँ नंदिनी की आराधना की जाती है। धार्मिक मान्यता के अनुसार यहाँ माता सती का हार गिरा था।"
    },
    {
      "id": 50,
      "name": "लंका शक्तिपीठ",
      "place": "श्रीलंका (सटीक स्थान अनिश्चित)",
      "description": "यह शक्तिपीठ माँ इंद्राक्षी को समर्पित है। मान्यता है कि यहाँ माता सती के टखने का पतन हुआ था।"
    },
    {
      "id": 51,
      "name": "विराट शक्तिपीठ",
      "place": "विराट क्षेत्र, राजस्थान अथवा पश्चिम बंगाल (स्थान को लेकर मतभेद)",
      "description": "यहाँ माँ अंबिका की आराधना की जाती है। धार्मिक मान्यता के अनुसार इस स्थान पर माता सती के पैर की उंगलियों का पतन हुआ था।"
    }
  ]
}
