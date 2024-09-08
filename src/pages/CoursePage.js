import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, set, remove } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './CoursePage.css';

function CoursePage() {
  const [mainCourses, setMainCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [subCourses, setSubCourses] = useState([]);
  const [selectedSubCourse, setSelectedSubCourse] = useState(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newSubCourseName, setNewSubCourseName] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [answers, setAnswers] = useState([{ text: '', correct: false }]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [media, setMedia] = useState({ images: [], videos: [], pdfs: [] });
  const [thumbnailURL, setThumbnailURL] = useState(''); // State for thumbnail URL
  const [isSavingQuestions, setIsSavingQuestions] = useState(false); // New state for saving questions

  const db = getDatabase();
  const storage = getStorage();
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const coursesRef = ref(db, 'courses/mainCourses');
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
        setSelectedSubCourse(null);
      });

      return () => unsubscribe();
    }
  }, [db, selectedCourse]);

  useEffect(() => {
    if (selectedCourse && selectedSubCourse) {
      const questionsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/questions`);
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

      const imagesRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/images`);
      const unsubscribeImages = onValue(imagesRef, (snapshot) => {
        const imagesData = snapshot.val();
        const imagesArray = imagesData ? Object.values(imagesData) : [];
        setMedia(prev => ({ ...prev, images: imagesArray }));
      });

      const videosRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/videos`);
      const unsubscribeVideos = onValue(videosRef, (snapshot) => {
        const videosData = snapshot.val();
        const videosArray = videosData ? Object.values(videosData) : [];
        setMedia(prev => ({ ...prev, videos: videosArray }));
      });

      const pdfsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/pdfs`);
      const unsubscribePdfs = onValue(pdfsRef, (snapshot) => {
        const pdfsData = snapshot.val();
        const pdfsArray = pdfsData ? Object.values(pdfsData) : [];
        setMedia(prev => ({ ...prev, pdfs: pdfsArray }));
      });

      return () => {
        unsubscribeQuestions();
        unsubscribeImages();
        unsubscribeVideos();
        unsubscribePdfs();
      };
    }
  }, [db, selectedCourse, selectedSubCourse]);

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) {
      setError('Question cannot be empty');
      return;
    }

    // Create a new question object
    const newQuestionObj = {
      text: newQuestion,
      answers,
    };

    // Clear form fields
    setNewQuestion('');
    setAnswers([{ text: '', correct: false }]);

    // Set new question in state
    setQuestions(prevQuestions => [...prevQuestions, newQuestionObj]);
  };

  const handleSaveQuestions = () => {
    if (selectedSubCourse) {
      const questionsRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/questions`);
      
      // Save all questions to the database
      Promise.all(questions.map(question => {
        const questionRef = push(questionsRef);
        return set(questionRef, question);
      }))
        .then(() => {
          setIsSavingQuestions(false); // Reset saving state
          setError('');
        })
        .catch((error) => {
          setError('Failed to save questions: ' + error.message);
        });
    } else {
      setError('Select a sub-course to save the questions');
    }
  };

  const handleAddCourse = () => {
    if (!newCourseName.trim() || !thumbnailURL) {
      setError('Course name or thumbnail cannot be empty');
      return;
    }

    const coursesRef = ref(db, 'courses/mainCourses');
    const newCourseRef = push(coursesRef);
    set(newCourseRef, { name: newCourseName, thumbnail: thumbnailURL })
      .then(() => {
        setNewCourseName('');
        setThumbnailURL(''); // Reset thumbnail URL
        setError('');
      })
      .catch((error) => {
        setError('Failed to add course: ' + error.message);
      });
  };

  const handleAddSubCourse = () => {
    if (!newSubCourseName.trim() || !selectedCourse) {
      setError('Sub-course name cannot be empty or course not selected');
      return;
    }

    const subCoursesRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses`);
    const newSubCourseRef = push(subCoursesRef);
    set(newSubCourseRef, { name: newSubCourseName })
      .then(() => {
        setNewSubCourseName('');
        setError('');
      })
      .catch((error) => {
        setError('Failed to add sub-course: ' + error.message);
      });
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const fileRef = storageRef(storage, `courses/${type}/${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          setError('Upload failed: ' + error.message);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            const mediaRef = ref(db, `courses/mainCourses/${selectedCourse}/subCourses/${selectedSubCourse}/${type}`);
            const newMediaRef = push(mediaRef);
            set(newMediaRef, downloadURL)
              .then(() => {
                setError('');
              })
              .catch((error) => {
                setError('Failed to add media: ' + error.message);
              });
          });
        }
      );
    }
  };

  const handleCourseThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileRef = storageRef(storage, `courses/thumbnails/${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          setError('Upload failed: ' + error.message);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setThumbnailURL(downloadURL); // Set the thumbnail URL in the state
          });
        }
      );
    }
  };

  const handleDeleteCourse = (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      const courseRef = ref(db, `courses/mainCourses/${courseId}`);
      remove(courseRef)
        .catch((error) => {
          setError('Failed to delete course: ' + error.message);
        });
    }
  };

  return (
    <div className="course-detail-container">
      <h1>Course Management</h1>
      <div className="course-actions">
        <input
          type="text"
          value={newCourseName}
          onChange={(e) => setNewCourseName(e.target.value)}
          placeholder="New Course Name"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleCourseThumbnailUpload(e)}
        />
        <button onClick={handleAddCourse}>Add Course</button>
      </div>
      {error && <p className="error">{error}</p>}
      {mainCourses.length > 0 && (
        <div className="course-list">
          <h2>Main Courses</h2>
          <div className="course-list">
            {mainCourses.map(course => (
              <div className="course-item" key={course.id}>
                {course.thumbnail && <img src={course.thumbnail} alt={`${course.name} thumbnail`} />}
                <h3>{course.name}</h3>
                <button onClick={() => handleDeleteCourse(course.id)}>Delete Course</button>
                <button onClick={() => setSelectedCourse(course.id)}>Manage Sub-Courses</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedCourse && (
        <div className="sub-course-section">
          <h2>Sub-Courses</h2>
          <div className="sub-course-list">
            {subCourses.length > 0 ? (
              subCourses.map(subCourse => (
                <div className="sub-course-item" key={subCourse.id}>
                  <h4>{subCourse.name}</h4>
                  <button onClick={() => setSelectedSubCourse(subCourse.id)}>Manage Sub-Course</button>
                </div>
              ))
            ) : (
              <p>No sub-courses available</p>
            )}
          </div>
          <div className="sub-course-actions">
            <input
              type="text"
              value={newSubCourseName}
              onChange={(e) => setNewSubCourseName(e.target.value)}
              placeholder="New Sub-Course Name"
            />
            <button onClick={handleAddSubCourse}>Add Sub-Course</button>
            <div>
              <h2>Upload Media</h2>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'images')}
              />
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileUpload(e, 'videos')}
              />
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileUpload(e, 'pdfs')}
              />
            </div>
          </div>
        </div>
      )}
      {selectedSubCourse && (
        <div className="question-actions">
          <h2>Add Question</h2>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="New Question"
          />
          {answers.map((answer, index) => (
            <div key={index}>
              <input
                type="text"
                value={answer.text}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[index].text = e.target.value;
                  setAnswers(newAnswers);
                }}
                placeholder={`Answer ${index + 1}`}
              />
              <input
                type="checkbox"
                checked={answer.correct}
                onChange={() => {
                  const newAnswers = [...answers];
                  newAnswers[index].correct = !newAnswers[index].correct;
                  setAnswers(newAnswers);
                }}
              /> Correct
            </div>
          ))}
          <button onClick={() => setAnswers([...answers, { text: '', correct: false }])}>Add Answer</button>
          <button onClick={handleAddQuestion}>Add Question</button>
          <button onClick={handleSaveQuestions} disabled={isSavingQuestions}>Save Questions</button>
        </div>
      )}
      {questions.length > 0 && (
        <div className="question-list">
          <h2>Questions</h2>
          <ul>
            {questions.map((question) => (
              <li key={question.id}>
                <p>{question.text}</p>
                <ul>
                  {question.answers.map((answer, index) => (
                    <li key={index}>
                      {answer.text} {answer.correct && '(Correct)'}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CoursePage;
