import React, { useState, useEffect } from "react";
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  remove,
} from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import "./CoursePage.css";

function CoursePage() {
  const [mainCourses, setMainCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [subCourses, setSubCourses] = useState([]);
  const [selectedSubCourse, setSelectedSubCourse] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswerText, setNewAnswerText] = useState("");
  const [answers, setAnswers] = useState([{ text: "", correct: false }]);
  const [questions, setQuestions] = useState([]);
  const [editQuestionIndex, setEditQuestionIndex] = useState(null);
  const [editAnswerIndex, setEditAnswerIndex] = useState(null);
  const [error, setError] = useState("");
  const [media, setMedia] = useState({ images: [], videos: [], pdfs: [] });
  const [thumbnailForNewCourse, setThumbnailForNewCourse] = useState(null);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newSubCourseName, setNewSubCourseName] = useState("");

  const db = getDatabase();
  const storage = getStorage();

  // Load main courses
  useEffect(() => {
    const coursesRef = ref(db, "courses/mainCourses");
    const unsubscribe = onValue(coursesRef, (snapshot) => {
      const coursesData = snapshot.val();
      const coursesArray = coursesData
        ? Object.keys(coursesData).map((key) => ({
            id: key,
            ...coursesData[key],
          }))
        : [];
      setMainCourses(coursesArray);
    });

    return () => unsubscribe();
  }, [db]);

  // Load sub-courses
  useEffect(() => {
    if (selectedCourse) {
      const subCoursesRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses`);
      const unsubscribe = onValue(subCoursesRef, (snapshot) => {
        const subCoursesData = snapshot.val();
        const subCoursesArray = subCoursesData
          ? Object.keys(subCoursesData).map((key) => ({
              id: key,
              ...subCoursesData[key],
            }))
          : [];
        setSubCourses(subCoursesArray);
        setSelectedSubCourse("");
      });

      return () => unsubscribe();
    }
  }, [db, selectedCourse]);

  // Load questions and media
  useEffect(() => {
    if (selectedCourse && selectedSubCourse) {
      const questionsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/questions`);
      const imagesRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/images`);
      const videosRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/videos`);
      const pdfsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/pdfs`);

      const unsubscribeQuestions = onValue(questionsRef, (snapshot) => {
        const questionsData = snapshot.val();
        const questionsArray = questionsData
          ? Object.keys(questionsData).map((key) => ({
              id: key,
              ...questionsData[key],
            }))
          : [];
        setQuestions(questionsArray);
      });

      const unsubscribeImages = onValue(imagesRef, (snapshot) => {
        const imagesData = snapshot.val();
        const imagesArray = imagesData ? Object.values(imagesData) : [];
        setMedia((prev) => ({ ...prev, images: imagesArray }));
      });

      const unsubscribeVideos = onValue(videosRef, (snapshot) => {
        const videosData = snapshot.val();
        const videosArray = videosData ? Object.values(videosData) : [];
        setMedia((prev) => ({ ...prev, videos: videosArray }));
      });

      const unsubscribePdfs = onValue(pdfsRef, (snapshot) => {
        const pdfsData = snapshot.val();
        const pdfsArray = pdfsData ? Object.values(pdfsData) : [];
        setMedia((prev) => ({ ...prev, pdfs: pdfsArray }));
      });

      return () => {
        unsubscribeQuestions();
        unsubscribeImages();
        unsubscribeVideos();
        unsubscribePdfs();
      };
    }
  }, [db, selectedCourse, selectedSubCourse]);

  // Handle media upload
  const handleMediaChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const mediaTypeMap = {
        "image/jpeg": "images",
        "image/png": "images",
        "video/mp4": "videos",
        "application/pdf": "pdfs",
      };

      const mediaType = mediaTypeMap[file.type];
      if (mediaType) {
        const mediaRef = storageRef(storage, `courses/${selectedCourse}/subCourses/${selectedSubCourse}/${mediaType}/${file.name}`);
        const uploadTask = uploadBytesResumable(mediaRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Handle progress, etc.
          },
          (error) => {
            setError("Failed to upload media: " + error.message);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              const mediaRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/${mediaType}`);
              const newMediaRef = push(mediaRef);
              set(newMediaRef, downloadURL)
                .then(() => setError(""))
                .catch((error) => setError("Failed to save media URL: " + error.message));
            });
          }
        );
      } else {
        setError("Unsupported media type");
      }
    }
  };

  // Add or edit question
  const handleAddOrEditQuestion = () => {
    if (!newQuestion.trim()) {
      setError("The question cannot be empty");
      return;
    }

    const newQuestionObj = {
      text: newQuestion,
      answers: [...answers],
    };

    if (editQuestionIndex !== null) {
      const updatedQuestions = [...questions];
      updatedQuestions[editQuestionIndex] = newQuestionObj;
      setQuestions(updatedQuestions);
      setEditQuestionIndex(null);
    } else {
      setQuestions([...questions, newQuestionObj]);
    }

    setNewQuestion("");
    setAnswers([{ text: "", correct: false }]);
    setError("");
  };

  // Add or update answer
  const handleAddOrUpdateAnswer = () => {
    if (newAnswerText.trim() === "") {
      setError("The answer text cannot be empty");
      return;
    }
  
    const updatedAnswers = [...answers];
    if (editAnswerIndex !== null) {
      updatedAnswers[editAnswerIndex] = {
        text: newAnswerText,
        correct: updatedAnswers[editAnswerIndex].correct,
      };
      setEditAnswerIndex(null);
    } else {
      updatedAnswers.push({ text: newAnswerText, correct: false });
    }
  
    setAnswers(updatedAnswers);
    setNewAnswerText("");
    setError("");
  };

  // Edit answer
  const handleEditAnswer = (index) => {
    if (index >= 0 && index < answers.length) {
      setNewAnswerText(answers[index].text);
      setEditAnswerIndex(index);
    }
  };

  // Set correct answer
  const handleCorrectAnswerChange = (index) => {
    const updatedAnswers = answers.map((answer, i) =>
      i === index ? { ...answer, correct: !answer.correct } : answer
    );
    setAnswers(updatedAnswers);
  };

  // Edit question
  const handleEditQuestionIndex = (index) => {
    const question = questions[index];
    setNewQuestion(question.text);
    setAnswers(question.answers || []);
    setEditQuestionIndex(index);
  };

  // Delete question
  const handleDeleteQuestion = (index) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
  };

  // Save questions
  const handleSaveQuestions = () => {
    if (!selectedSubCourse) {
      setError("Select a sub-course to save questions");
      return;
    }
  
    if (questions.length === 0) {
      setError("There are no questions to save");
      return;
    }
  
    setIsSavingQuestions(true);
  
    const questionsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/questions`);
  
    remove(questionsRef)
      .then(() => {
        Promise.all(
          questions.map((question) => {
            const questionRef = push(questionsRef);
            return set(questionRef, question);
          })
        )
          .then(() => {
            setIsSavingQuestions(false);
            setQuestions([]);
            setError("");
          })
          .catch((error) => {
            setIsSavingQuestions(false);
            setError("Failed to save questions: " + error.message);
          });
      })
      .catch((error) => {
        setIsSavingQuestions(false);
        setError("Failed to delete old questions: " + error.message);
      });
  };

  // Add course
  const handleAddCourse = () => {
    if (!newCourseName.trim()) {
      setError("Course name cannot be empty");
      return;
    }

    const newCourseRef = ref(db, `courses/mainCourses/${newCourseName}`);
    set(newCourseRef, { name: newCourseName })
      .then(() => {
        setNewCourseName("");
        setError("");
      })
      .catch((error) => setError("Failed to add course: " + error.message));
  };

  // Add sub-course
  const handleAddSubCourse = () => {
    if (!newSubCourseName.trim()) {
      setError("Sub-course name cannot be empty");
      return;
    }

    const newSubCourseRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${newSubCourseName}`);
    set(newSubCourseRef, { name: newSubCourseName })
      .then(() => {
        setNewSubCourseName("");
        setError("");
      })
      .catch((error) => setError("Failed to add sub-course: " + error.message));
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = () => {
    if (thumbnailForNewCourse) {
      const thumbnailRef = storageRef(storage, `courses/thumbnails/${thumbnailForNewCourse.name}`);
      const uploadTask = uploadBytesResumable(thumbnailRef, thumbnailForNewCourse);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Handle progress, etc.
        },
        (error) => {
          setError("Failed to upload thumbnail: " + error.message);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            const newCourseRef = ref(db, `courses/mainCourses/${newCourseName}`);
            set(newCourseRef, { name: newCourseName, thumbnail: downloadURL })
              .then(() => {
                setThumbnailForNewCourse(null);
                setError("");
              })
              .catch((error) => setError("Failed to save thumbnail URL: " + error.message));
          });
        }
      );
    }
  };

  return (
    <div className="course-page">
      <div className="course-selection">
        <h2>Select Main Course</h2>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          <option value="">--Select Course--</option>
          {mainCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
        <button onClick={handleAddCourse}>Add Course</button>
        <input
          type="text"
          value={newCourseName}
          onChange={(e) => setNewCourseName(e.target.value)}
          placeholder="New course name"
        />
        <input
          type="file"
          onChange={(e) => setThumbnailForNewCourse(e.target.files[0])}
        />
        <button onClick={handleThumbnailUpload}>Upload Thumbnail</button>
      </div>

      {selectedCourse && (
        <div className="sub-course-selection">
          <h2>Select Sub-Course</h2>
          <select
            value={selectedSubCourse}
            onChange={(e) => setSelectedSubCourse(e.target.value)}
          >
            <option value="">--Select Sub-Course--</option>
            {subCourses.map((subCourse) => (
              <option key={subCourse.id} value={subCourse.id}>
                {subCourse.name}
              </option>
            ))}
          </select>
          <button onClick={handleAddSubCourse}>Add Sub-Course</button>
          <input
            type="text"
            value={newSubCourseName}
            onChange={(e) => setNewSubCourseName(e.target.value)}
            placeholder="New sub-course name"
          />
        </div>
      )}

      {selectedCourse && selectedSubCourse && (
        <div className="questions-section">
          <h2>Manage Questions</h2>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="New question"
          />
          <button onClick={handleAddOrEditQuestion}>
            {editQuestionIndex !== null ? "Update Question" : "Add Question"}
          </button>

          {questions.map((question, index) => (
            <div key={index} className="question">
              <h3>{question.text}</h3>
              {question.answers.map((answer, answerIndex) => (
                <div key={answerIndex} className="answer">
                  <input
                    type="text"
                    value={answer.text}
                    readOnly
                  />
                  <input
                    type="checkbox"
                    checked={answer.correct}
                    onChange={() => handleCorrectAnswerChange(answerIndex)}
                  />
                  <button onClick={() => handleEditAnswer(answerIndex)}>Edit Answer</button>
                </div>
              ))}
              <input
                type="text"
                value={newAnswerText}
                onChange={(e) => setNewAnswerText(e.target.value)}
                placeholder="New answer"
              />
              <button onClick={handleAddOrUpdateAnswer}>
                {editAnswerIndex !== null ? "Update Answer" : "Add Answer"}
              </button>
              <button onClick={() => handleEditQuestionIndex(index)}>
                Edit Question
              </button>
              <button onClick={() => handleDeleteQuestion(index)}>
                Delete Question
              </button>
            </div>
          ))}
          {isSavingQuestions && <p>Saving questions...</p>}
          <button onClick={handleSaveQuestions}>Save Questions</button>
        </div>
      )}

      <div className="media-upload">
        <h2>Upload Media</h2>
        <input type="file" onChange={handleMediaChange} />
        {error && <p className="error">{error}</p>}
      </div>

      <div className="media-display">
        <h2>Media</h2>
        <div className="media-gallery">
          {media.images.length > 0 && (
            <div className="image-gallery">
              {media.images.map((url, index) => (
                <img key={index} src={url} alt={`Uploaded ${index}`} />
              ))}
            </div>
          )}
          {media.videos.length > 0 && (
            <div className="video-gallery">
              {media.videos.map((url, index) => (
                <video key={index} controls>
                  <source src={url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ))}
            </div>
          )}
          {media.pdfs.length > 0 && (
            <div className="pdf-gallery">
              {media.pdfs.map((url, index) => (
                <iframe
                  key={index}
                  src={url}
                  width="600"
                  height="800"
                  title={`PDF ${index}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CoursePage;
